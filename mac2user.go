package main

import (
  "sync"
  //"fmt"
  "time"
  //"encoding/json"
  "database/sql"
  _ "github.com/go-sql-driver/mysql"
  //"github.com/gomodule/redigo/redis"
)

func mac2user(wg *sync.WaitGroup, boot_wg *sync.WaitGroup, stop_ch chan struct{}) {
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


  db, db_err = sql.Open("mysql", config.Options.Wifi_db_dsn)

  if db_err != nil {
    logError("mac2user: DB Open error, will not continue", db_err.Error())
    return
  }

  bootstrapped := false

  WORK_CYCLE: for {

    var rows *sql.Rows

    rows, db_err = db.Query("SELECT CONCAT(wifi_user.username, '@', suffix), display_name, change_reason, mac"+
     " FROM (wifi_password INNER JOIN wifi_user ON wifi_user.id=user_id) INNER JOIN wifi_domain on wifi_domain.id=domain_id"+
     " WHERE wifi_user.active = 1 AND mac != '' AND (until = 0 OR until > UNIX_TIMESTAMP() OR until IS NULL)"+
     " UNION SELECT username, created_reason, created_reason, mac FROM cards WHERE (until = 0 OR until > UNIX_TIMESTAMP() OR until IS NULL) AND mac IS NOT NULL AND mac != ''")

    if db_err != nil {
      if db_ok {
        logError("mac2user: DB query error:", db_err.Error())
      }
      db_ok = false
    } else {

      macs := make(map[string][]macInfo)

      for rows.Next() {
        var wifi_user string;
        var display_name string;
        var reason string;
        var mac string;

        db_err = rows.Scan(&wifi_user, &display_name, &reason, &mac)
        if db_err != nil {
          break
        }

        macs[mac] = append(macs[mac], macInfo{Username: wifi_user, Displayname: display_name, Reason: reason})
      }
      rows.Close()

      if db_err != nil {
        if db_ok {
          logError("mac2user: DB query error:", db_err.Error())
        }
        db_ok = false
      } else if rows.Err() != nil {
        if db_ok {
          logError("mac2user: DB query error:", rows.Err().Error())
        }
        db_ok = false
      } else {
        if !db_ok {
          logError("mac2user: DB restored", "")
        }
        db_ok = true

        globalMutex.Lock()
        globalMacInfo = make(map[string][]macInfo)
        for mac, macinfo := range macs {
          for _, item := range macinfo {
            globalMacInfo[mac] = append(globalMacInfo[mac], item)
          }
        }
        globalMutex.Unlock()

        if !bootstrapped {
          boot_wg.Done()
          bootstrapped = true
        }
      }
    }


    worker_timer := time.NewTimer(time.Duration(config.Options.Db_refresh_period) * time.Second)

    select {
    case <-stop_ch:
      worker_timer.Stop()
      break WORK_CYCLE
    case <-worker_timer.C:
      continue WORK_CYCLE
    }
  }
}
