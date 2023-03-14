package main

import (
  "sync"
  "context"
  "net/http"
  "bufio"
  _ "fmt"
  "time"
  "regexp"
  "strings"
  //"encoding/json"
  "compress/gzip"
  _ "github.com/qdm12/reprint"
  "github.com/jimlawless/whereami"
  "github.com/gomodule/redigo/redis"
)

var oui_regex *regexp.Regexp

func init() {
  whereami.WhereAmI()
  oui_regex = regexp.MustCompile(`^([0-9a-fA-F]{2})-([0-9a-fA-F]{2})-([0-9a-fA-F]{2})\s+\(hex\)\s+(\S.+\S)\s*$`)
}

func oui(wg *sync.WaitGroup, boot_wg *sync.WaitGroup, stop_ch chan struct{}) {

  defer func() {
    wg.Done()
  } ()

  ctx, cancel := context.WithCancel(context.Background())
  defer cancel()

  client := &http.Client{ Timeout: time.Duration(config.Options.Oui_timeout)*time.Second }

//fmt.Println(whereami.WhereAmI())

  //bootstrap

  red, red_err := redis.Dial(config.Options.Redis_conn_type, config.Options.Redis_conn_address, redis.DialDatabase(config.Options.Redis_db))
  if red_err == nil {
    var boot_oui map[string]string
    boot_oui, red_err = redis.StringMap(redis.DoWithTimeout(red, time.Duration(config.Options.Redis_timeout)*time.Second, "HGETALL", "oui"))
    if red_err == nil {
      globalMutex.Lock()
      globalOui = boot_oui
      globalMutex.Unlock()
    }
    red.Close()
  }

  boot_wg.Done()

  WORK_CYCLE: for {

    done_ch := make(chan struct{})
    var req_error error

    go func() {
      // really do request
      defer close(done_ch)

      var err error
      var req *http.Request
      var resp *http.Response

      req, err = http.NewRequestWithContext(ctx, "GET", config.Options.Oui_url, nil)
      if err != nil {
        logError("oui: NewRequestWithContext error:", err.Error())
        req_error = err
        return
      }

      resp, err = client.Do(req)

      if err != nil {
        select {
        case <- ctx.Done():
          //exit signalled
        default:
          logError("oui: Request error: ", err.Error())
          req_error = err
        }
        return
      }
      defer resp.Body.Close()

      var bio *bufio.Scanner
      var reader *gzip.Reader

      if strings.HasSuffix(config.Options.Oui_url, ".gz") {
        reader, err = gzip.NewReader(resp.Body)
        if err != nil {
          logError("oui: gzip.NewReader error:", err.Error())
          req_error = err
          return
        }
        defer reader.Close()
        bio = bufio.NewScanner(reader)
      } else {
        bio = bufio.NewScanner(resp.Body)
      }

      new_oui2corp := make(map[string]string)

      red, red_err = redis.Dial(config.Options.Redis_conn_type, config.Options.Redis_conn_address,
        redis.DialDatabase(config.Options.Redis_db))

      if red_err == nil {
        _, red_err = redis.DoWithTimeout(red, time.Duration(config.Options.Redis_timeout)*time.Second, "DEL", "oui_temp")
        if red_err == redis.ErrNil {
          red_err = nil
        }
      }

      for bio.Scan() {
        matches := oui_regex.FindStringSubmatch(bio.Text())
        if matches != nil {
          oui_str := strings.ToLower(matches[1])+strings.ToLower(matches[2])+strings.ToLower(matches[3])
          new_oui2corp[oui_str] = matches[4]

          if red_err == nil {
            _, red_err = redis.DoWithTimeout(red, time.Duration(config.Options.Redis_timeout)*time.Second, "HSET", "oui_temp", oui_str, matches[4])
          }
        }
      }

      if red_err == nil {
        _, red_err = redis.DoWithTimeout(red, time.Duration(config.Options.Redis_timeout)*time.Second, "HSET", "oui_temp", "time", time.Now().String())
      }

      if red_err == nil {
        _, red_err = redis.DoWithTimeout(red, time.Duration(config.Options.Redis_timeout)*time.Second, "RENAME", "oui_temp", "oui")
      }

      if red != nil {
        red.Close()
      }

      err = bio.Err()
      if err != nil {
        logError("oui: Scan error:", err.Error())
        req_error = err
        return
      }

      globalMutex.Lock()
      globalOui = new_oui2corp
      globalMutex.Unlock()

    } ()

    select {
    case <-stop_ch:
      cancel()
    case <-done_ch:
    }


    var worker_timer *time.Timer
    if req_error == nil {
      worker_timer = time.NewTimer(time.Duration(config.Options.Oui_refresh_period) * time.Second)
    } else {
      worker_timer = time.NewTimer(time.Duration(config.Options.Oui_error_sleep) * time.Second)
    }

    select {
    case <-stop_ch:
      worker_timer.Stop()
      break WORK_CYCLE
    case <-worker_timer.C:
      continue WORK_CYCLE
    }
  }
}
