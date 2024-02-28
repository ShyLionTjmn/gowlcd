package main

import (
  "fmt"
  "net"
  "os"
  "sync"
  "time"
  "regexp"
  "strings"
  "encoding/json"

  snmp "github.com/gosnmp/gosnmp"
  "github.com/sleepinggenius2/gosmi"
  "github.com/sleepinggenius2/gosmi/types"
  "github.com/sleepinggenius2/gosmi/models"

  "github.com/gomodule/redigo/redis"
)

var cldcClientSessionId_reg *regexp.Regexp

func init() {
  cldcClientSessionId_reg = regexp.MustCompile(`^[0-9a-fA-F]+\/([0-9a-fA-F]{2})[:\-\.]?([0-9a-fA-F]{2})[:\-\.]?([0-9a-fA-F]{2})[:\-\.]?([0-9a-fA-F]{2})[:\-\.]?([0-9a-fA-F]{2})[:\-\.]?([0-9a-fA-F]{2})\/[0-9a-fA-F]+$`)
}

func trapserver(wg *sync.WaitGroup, stop_ch chan struct{}) {
  defer wg.Done()
  var tl *snmp.TrapListener

  gosmi.Init()
  for _, dir := range config.Options.Traps_mib_dirs {
    gosmi.AppendPath(dir)
  }
  fmt.Println("trapserver: loading modules")
  for _, module := range config.Options.Traps_mib_modules {
    _, err := gosmi.LoadModule(module)
    if err != nil {
      fmt.Fprintf(os.Stderr, "Error loading SNMP MIB module %s: %s\n", module, err.Error())
    }
  }
  fmt.Println("trapserver: done loading modules")

  tl = snmp.NewTrapListener()
  tl.OnNewTrap = myTrapHandler
  tl.Params = snmp.Default

  var gr_wg sync.WaitGroup
  gr_wg.Add(1)

  go func() {
    defer gr_wg.Done()

    err := tl.Listen(config.Options.Traps_listen)
    if err != nil {
      fmt.Fprintf(os.Stderr, "trapserver: error in listen: %s\n", err)
    }
  } ()

  select {
  case <-stop_ch:
   tl.Close()
  }

  gr_wg.Wait()
}

var trapserver_red redis.Conn
var trapserver_red_err error
var trapserver_red_ok bool = true

func myTrapHandler(packet *snmp.SnmpPacket, addr *net.UDPAddr) {

  trap := make(map[string]string)

  for _, v := range packet.Variables {

    var key string = v.Name
    var value string = fmt.Sprint(v.Value)

    node, err := gosmi.GetNodeByOID( types.OidMustFromString(v.Name) )
    if err == nil {
      switch node.Kind.String() {
      case "Scalar", "Column":
        key = node.Name
        if node.Name == "snmpTrapOID" {
          trap_node, err := gosmi.GetNodeByOID( types.OidMustFromString(v.Value.(string)) )
          if err == nil {
            value = trap_node.Name
          } else {
            value = v.Value.(string)
          }
        } else if node.Name == "cldcClientRSSI" && v.Type.String() == "OctetString" {
          // cisco bug
          key = "cldcClientUsername"
          value = string(v.Value.([]byte))
        } else if node.Name == "cldcClientSNR" && v.Type.String() == "OctetString" {
          // cisco bug
          key = "cldcClientSSID"
          value = string(v.Value.([]byte))
        } else {
          if node.Type != nil {
            if node.Type.Name == "MacAddress" && node.Type.BaseType == types.BaseTypeOctetString {
              node.Type.Format = "1x"
            } else if node.Type.Name == "OctetString" && node.Type.BaseType == types.BaseTypeOctetString {
              node.Type.Format = "255a"
            }
            value = node.Type.FormatValue(v.Value, models.FormatAll).String()
          }
        }
      default:
        if _, ex := globalUnknownOIDs[v.Name]; !ex {
          fmt.Fprintln(os.Stderr, "Unknown OID "+v.Name)
          globalMutex.Lock()
          globalUnknownOIDs[v.Name]=struct{}{}
          globalMutex.Unlock()
        }
      }
    } else {
      if _, ex := globalUnknownOIDs[v.Name]; !ex {
        fmt.Fprintln(os.Stderr, "Unknown OID "+v.Name)
        globalMutex.Lock()
        globalUnknownOIDs[v.Name]=struct{}{}
        globalMutex.Unlock()
      }
    }

    trap[key] = value
  }

  trap["wlc"] = addr.IP.String()

  _, ses_mac_ex := trap["cldcClientMacAddress"]

  if ses_id, ses_ex := trap["cldcClientSessionId"]; ses_ex && !ses_mac_ex {
    //there is cldcClientSessionId but no cldcClientMacAddress in trap. Add it from SessionId
    matches := cldcClientSessionId_reg.FindStringSubmatch(ses_id)
    if matches != nil && len(matches) == 7 {
      trap["cldcClientMacAddress"] = strings.ToLower( matches[1]+matches[2]+matches[3]+matches[4]+matches[5]+matches[6] )
    }
  }

  _, ses_mac_ex = trap["cldcClientMacAddress"]

  if ses_id, ses_ex := trap["cldcClientSessionID"]; ses_ex && !ses_mac_ex {
    //UPPERCASE key
    //there is cldcClientSessionID but no cldcClientMacAddress in trap. Add it from SessionID
    matches := cldcClientSessionId_reg.FindStringSubmatch(ses_id)
    if matches != nil && len(matches) == 7 {
      trap["cldcClientMacAddress"] = strings.ToLower( matches[1]+matches[2]+matches[3]+matches[4]+matches[5]+matches[6] )
    }
  }

  json, jerr := json.MarshalIndent(trap, "", "  ")
  if jerr != nil {
    fmt.Fprintln(os.Stderr, jerr.Error())
    return
  }

  var logged = false

  now := time.Now().Unix()

  hist_log := make([]histLogEntry, 0)

  for _, key := range config.Options.Traps_keys_user {
    if value, exists := trap[key]; exists && value != "" {
      logged = true
      hist_log = append(hist_log, histLogEntry{ "user", "trap", value, now, string(json) })
    }
  }

  for _, key := range config.Options.Traps_keys_mac {
    if value, exists := trap[key]; exists && value != "" {
      logged = true
      hist_log = append(hist_log, histLogEntry{ "mac", "trap", value, now, string(json) })
    }
  }

  if !logged {
    for _, key := range config.Options.Traps_keys_ap {
      if value, exists := trap[key]; exists && value != "" {
        logged = true
        hist_log = append(hist_log, histLogEntry{ "ap", "trap", value, now, string(json) })
      }
    }
  }

  if !logged {
    hist_log = append(hist_log, histLogEntry{ "wlc", "trap", addr.IP.String(), now, string(json) })
  }

  if trapserver_red == nil {
    trapserver_red, trapserver_red_err = redis.Dial(config.Options.Redis_conn_type, config.Options.Redis_conn_address, redis.DialDatabase(config.Options.Redis_db))
    if trapserver_red_err != nil {
      trapserver_red = nil
      if trapserver_red_ok {
        logError("trapserver: "+addr.IP.String(), "Redis Dial error: "+trapserver_red_err.Error())
      }
      trapserver_red_ok = false
    } else {
      if !trapserver_red_ok {
        logError("trapserver: "+addr.IP.String(), "Redis connected")
      }
      trapserver_red_ok = true
    }
  }


  if trapserver_red != nil && trapserver_red_ok && len(hist_log) > 0 {
    var trapserver_red_err error
    etypes_trim := make(map[string]int)
    for _, e := range hist_log {
      etime := fmt.Sprintf("%d", e.Time)

      //debug logs
      if _, trapserver_red_err = trapserver_red.Do("PUBLISH", "log", etime+"\t"+e.Type+"\t"+e.Event+"\t"+e.Subject+"\t"+e.Info); trapserver_red_err != nil {
        break
      }
      if _, trapserver_red_err = trapserver_red.Do("PUBLISH", "log_"+e.Type, etime+"\t"+e.Event+"\t"+e.Subject+"\t"+e.Info); trapserver_red_err != nil {
        break
      }
      if _, trapserver_red_err = trapserver_red.Do("PUBLISH", "log_"+e.Type+"_"+e.Event, etime+"\t"+e.Subject+"\t"+e.Info); trapserver_red_err != nil {
        break
      }
      if _, trapserver_red_err = trapserver_red.Do("PUBLISH", "log_"+e.Type+"_"+e.Subject, etime+"\t"+e.Event+"\t"+e.Info); trapserver_red_err != nil {
        break
      }
      if _, trapserver_red_err = trapserver_red.Do("PUBLISH", "log_"+e.Type+"_"+e.Event+"_"+e.Subject, etime+"\t"+e.Info); trapserver_red_err != nil {
        break
      }

      //global event logs
      if _, trapserver_red_err = trapserver_red.Do("LPUSH", "events_"+e.Type, etime+"\t"+e.Event+"\t"+e.Subject+"\t"+e.Info); trapserver_red_err != nil {
        break
      } else {
        etypes_trim["events_"+e.Type] = 1
      }

      if _, trapserver_red_err = trapserver_red.Do("LPUSH", "events_"+e.Type+"_"+e.Subject, etime+"\t"+e.Event+"\t"+e.Info); trapserver_red_err != nil {
        break
      }

      if _, trapserver_red_err = trapserver_red.Do("LTRIM", "events_"+e.Type+"_"+e.Subject, 0, config.Options.Redis_subject_events_trim); trapserver_red_err != nil {
        break
      }

      //per subject event log
    }

    if trapserver_red_err == nil {
      for key, _ := range etypes_trim {
        if _, trapserver_red_err = trapserver_red.Do("LTRIM", key, 0, config.Options.Redis_global_events_trim); trapserver_red_err != nil {
          break
        }
      }
    }

    if trapserver_red_err != nil {
      trapserver_red.Close()
      trapserver_red = nil
      if trapserver_red_ok {
        logError("trapserver: "+addr.IP.String(), "Redis error: "+trapserver_red_err.Error())
      }
      trapserver_red_ok = false
    }
  }
}
