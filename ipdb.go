package main

import (
  "sync"
  //"fmt"
  "time"
  "math"
  "errors"
  "strings"
  //"encoding/json"
  "database/sql"
  _ "github.com/go-sql-driver/mysql"
  //"github.com/gomodule/redigo/redis"
  "github.com/qdm12/reprint"
  "github.com/jimlawless/whereami"
)

func init() {
  whereami.WhereAmI()
}

const allOnes uint32=0xFFFFFFFF

func query_db(db *sql.DB) error {
  ip2site := make(map[uint32]*siteInfo)

  var query string
  var err error
  var rows []M
  var tag_rows []M
  var var_ok bool

  tags_index := make(map[string]int)
  var location_root string

  query = "SELECT * FROM tags"
  if tag_rows, err = return_query_A(db, query); err != nil { return err; }

  for i, row := range tag_rows {
    var tag_id string
    if tag_id, var_ok = row.UintString("tag_id"); !var_ok { return errors.New("no tag_id") }

    var tag_api_name string
    tag_api_name, _ = row.String("tag_api_name")
    if tag_api_name == "location" {
      location_root = tag_id
    }

    tags_index[tag_id] = i
  }

  if location_root == "" {
    return errors.New("no location root tag found")
  }

  var traverse func(string, int) (string, error)
  traverse = func(tag_id string, counter int) (string, error) {
    if counter > 100 { return "", errors.New("tags loop detected") }
    var row_index int
    var ex bool
    if row_index, ex = tags_index[tag_id]; !ex { return "", errors.New("No tag "+tag_id+" in index") }
    if _, ex = tag_rows[row_index]["_nl"]; ex { return "", nil }
    if tag_id == location_root { return tag_id, nil }
    if tag_rows[row_index]["tag_fk_tag_id"] == nil { return "", nil }
    var parent_id string
    if parent_id, ex = tag_rows[row_index].UintString("tag_fk_tag_id"); !ex { return "", errors.New("No parent tag for "+tag_id) }
    if path, err := traverse(parent_id, counter + 1); err != nil {
      return "", err
    } else {
      if path == "" {
        tag_rows[row_index]["_nl"] = struct{}{}
        return "", nil
      }
      return path+","+tag_id, nil
    }
  }

  query = "SELECT v4net_addr, v4net_last, v4net_name, v4net_tags, v4net_mask FROM v4nets WHERE v4net_tags != ''"
  if rows, err = return_query_A(db, query); err != nil { return err }

  for _, row := range rows {
    var row_tags string
    row_tags, _ = row.String("v4net_tags")
    if row_tags != "" {
      var u64 uint64
      var ip_addr uint32
      var ip_last uint32
      var mask uint8
      var net_name string

      if u64, var_ok = row.Uint64("v4net_addr"); !var_ok { return errors.New("no v4net_addr") }
      if u64 > math.MaxUint32 { return errors.New("v4net_addr overflow") }
      ip_addr = uint32(u64)
      if u64, var_ok = row.Uint64("v4net_last"); !var_ok { return errors.New("no v4net_last") }
      if u64 > math.MaxUint32 { return errors.New("v4net_last overflow") }
      ip_last = uint32(u64)
      if u64, var_ok = row.Uint64("v4net_mask"); !var_ok { return errors.New("no v4net_mask") }
      if u64 > math.MaxUint8 { return errors.New("v4net_mask overflow") }
      mask = uint8(u64)

      net_name, _ = row.String("v4net_name")

      tags_list := strings.Split(row_tags, ",")
      for _, tag_id := range tags_list {
        if tag_i, ex := tags_index[tag_id]; ex {
          var tag_name string
          if tag_name, var_ok = tag_rows[tag_i].String("tag_name"); !var_ok { return errors.New("no tag_name") }
          tags_path, err := traverse(tag_id, 0)
          if err != nil { return err }
          if tags_path != "" {
            ip2site[ip_addr] = &siteInfo{mask, tag_name, tags_path, net_name, ip_addr, ip_last}
          }
        }
      }
    }
  }


  query = "SELECT v4ip_addr, v4net_name, iv_value"+
          " FROM ((((v4ips"+
               " INNER JOIN v4nets ON v4ip_fk_v4net_id=v4net_id)"+
               " INNER JOIN n4cs ON nc_fk_v4net_id=v4net_id)"+
               " INNER JOIN ics ON nc_fk_ic_id=ic_id)"+
               " INNER JOIN i4vs ON iv_fk_ic_id=ic_id AND iv_fk_v4ip_id=v4ip_id)"+
          " WHERE iv_value != '' AND ic_type='tag' AND ic_api_name='location'"
  if rows, err = return_query_A(db, query); err != nil { return err }

  for _, row := range rows {
    var row_tags string
    row_tags, _ = row.String("iv_value")
    if row_tags != "" {
      var u64 uint64
      var ip_addr uint32
      var net_name string

      if u64, var_ok = row.Uint64("v4ip_addr"); !var_ok { return errors.New("no v4net_addr") }
      if u64 > math.MaxUint32 { return errors.New("v4net_addr overflow") }
      ip_addr = uint32(u64)

      net_name, _ = row.String("v4net_name")

      tags_list := strings.Split(row_tags, ",")
      for _, tag_id := range tags_list {
        if tag_i, ex := tags_index[tag_id]; ex {
          var tag_name string
          if tag_name, var_ok = tag_rows[tag_i].String("tag_name"); !var_ok { return errors.New("no tag_name") }
          tags_path, err := traverse(tag_id, 0)
          if err != nil { return err }
          if tags_path != "" {
            ip2site[ip_addr] = &siteInfo{32, tag_name, tags_path, net_name, ip_addr, ip_addr}
          }
        }
      }
    }
  }

  globalMutex.Lock()

  globalSites = make(map[uint32]*siteInfo)
  reprint.FromTo(&ip2site, &globalSites)

  globalMutex.Unlock()

//  j,_ := json.MarshalIndent(globalSites, "", "  ")
//  fmt.Println(string(j))

  return nil
}

func ipdb(wg *sync.WaitGroup, boot_wg *sync.WaitGroup, stop_ch chan struct{}) {
  var db *sql.DB=nil
  var db_err error=nil
  var db_ok bool=true

  defer func() {
    if db != nil {
      db.Close()
      db = nil
    }
    wg.Done()
  } ()

//fmt.Println(whereami.WhereAmI())

  db, db_err = sql.Open("mysql", config.Options.Ipdb_db_dsn)
  if db_err != nil {
    logError("ipdb: DB Open error, will not continue.", db_err.Error())
    return
  }

  bootstrapped := false

  WORK_CYCLE: for {
    if db_err = query_db(db); db_err != nil {
      if db_ok {
        logError("ipdb: DB query error:", db_err.Error())
      }
      db_ok = false
    } else {
      if !db_ok {
        logError("ipdb: DB queried Ok", "")
      }
      db_ok = true

      if !bootstrapped {
        boot_wg.Done()
        bootstrapped = true
      }
    }

    worker_timer := time.NewTimer(time.Duration(config.Options.Db_refresh_period) * time.Second)
    //worker_timer := time.NewTimer(2*time.Second)

    select {
    case <-stop_ch:
      worker_timer.Stop()
      break WORK_CYCLE
    case <-worker_timer.C:
      continue WORK_CYCLE
    }
  }
}
