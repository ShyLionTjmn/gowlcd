package main

import (
  "sync"
  //"fmt"
  "time"
  "regexp"
  //"encoding/json"
  "database/sql"
  _ "github.com/go-sql-driver/mysql"
  //"github.com/gomodule/redigo/redis"
  "github.com/qdm12/reprint"
  "github.com/jimlawless/whereami"
)

var site_tag_regex *regexp.Regexp

func init() {
  whereami.WhereAmI()
  site_tag_regex = regexp.MustCompile(`(?:^|[,;])\s*site=([^,;]*)\s*(?:$|[,;])`)
}

const allOnes uint32=0xFFFFFFFF

func query_db(db *sql.DB) error {
  ip2site := make(map[uint32]*siteInfo)

  rows, err := db.Query("SELECT ipu, mask, tags, name FROM nets WHERE tags LIKE '%site=%'")
  if err != nil { return err; }

  for rows.Next() {
    var ipu uint32;
    var plen uint8;
    var tags string;
    var netname string;

    err = rows.Scan(&ipu, &plen, &tags, &netname)
    if err != nil {
      rows.Close()
      return err;
    }

    matches := site_tag_regex.FindStringSubmatch(tags)
    if matches != nil {

      mask := uint32( (allOnes << (32-plen)) & allOnes )
      wc := uint32( (^mask) & allOnes )
      first := ipu & mask
      last := ipu | wc

      ip2site[ipu] = &siteInfo{plen, matches[1], netname, first, last}
    }
  }
  rows.Close()

  rows, err = db.Query("SELECT ipdata.ipu, TRIM(value) as site, name"+
    " FROM ((ipdata"+
    " INNER JOIN columns ON ipdata.cid=columns.id)"+
    " INNER JOIN ips ON ips.ipu=ipdata.ipu)"+
    " INNER JOIN nets ON ips.nipu=nets.ipu"+
    " WHERE cname='SITE_ID' HAVING site != ''")
  if err != nil { return err; }

  for rows.Next() {
    var ipu uint32;
    var site string;
    var netname string;

    err = rows.Scan(&ipu, &site, &netname)
    if err != nil {
      rows.Close()
      return err;
    }

    ip2site[ipu] = &siteInfo{32, site, netname, ipu, ipu}
  }
  rows.Close()

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
