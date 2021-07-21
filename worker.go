package main

import (
  "os"
  "errors"
  "sync"
  "time"
  "net"
  "fmt"
  "regexp"
  "strings"
  "strconv"
  "encoding/json"
  snmp "github.com/gosnmp/gosnmp"
  "github.com/gomodule/redigo/redis"
  "github.com/qdm12/reprint"
  rrd "github.com/multiplay/go-rrd"
  "encoding/binary"
)

type workStruct struct {
  dev_ip        string
//  control_ch    chan string
//  data_ch       chan t_scanData
  wg            *sync.WaitGroup
  added         time.Time
  check         time.Time
  conn          net.Conn
}

const (
  //item type
  itOne         =iota
  itTable
  //item value type
  vtInt
  vtUns
  vtString
  vtHex
  vtOid
  //scan data type
  dtExit //goroutine desided to exit
)

var const2str = map[int]string{
  itOne:        "one",
  itTable:      "table",
  //item value type
  vtInt:        "int",
  vtUns:        "uns",
  vtString:     "str",
  vtHex:        "hex",
  vtOid:        "oid",
  //scan data type
  dtExit:       "exit",
}

var wlc_singles = map[string]string{
  "host_name": ".1.3.6.1.2.1.1.5.0",
  "sys_object_id": ".1.3.6.1.2.1.1.2.0",
  "model": ".1.3.6.1.2.1.47.1.1.1.1.13.1",
  "software": ".1.3.6.1.2.1.47.1.1.1.1.10.1",
  "serial": ".1.3.6.1.2.1.47.1.1.1.1.11.1",
}

var wlc_uint_tables = map[string]string{
  "ap_uptime":                  ".1.3.6.1.4.1.9.9.513.1.1.1.1.7",
}

var wlc_hex_tables = map[string]string{
  "cdp_nei_address":            ".1.3.6.1.4.1.9.9.623.1.3.1.1.8",
  "ap_mac":                     ".1.3.6.1.4.1.14179.2.2.1.1.1",
  "cl_mac":                 ".1.3.6.1.4.1.14179.2.1.4.1.1",
  "cl_ap_mac":              ".1.3.6.1.4.1.14179.2.1.4.1.4",
}

var wlc_tables = map[string]string{
  //per AP
  "ap_name":                    ".1.3.6.1.4.1.14179.2.2.1.1.3",
  "ap_num_slots":               ".1.3.6.1.4.1.14179.2.2.1.1.2",
  "ap_ip":                      ".1.3.6.1.4.1.14179.2.2.1.1.19",
  "ap_model":                   ".1.3.6.1.4.1.14179.2.2.1.1.16",
  "ap_serial":                  ".1.3.6.1.4.1.14179.2.2.1.1.17",
  "ap_location":                ".1.3.6.1.4.1.14179.2.2.1.1.4",
  //per AP radio
  "r_type":              ".1.3.6.1.4.1.14179.2.2.2.1.2",
  "r_state":             ".1.3.6.1.4.1.14179.2.2.2.1.12",
  "r_channel":           ".1.3.6.1.4.1.14179.2.2.2.1.4",
  "r_power":             ".1.3.6.1.4.1.14179.2.2.2.1.6",
  "r_users":             ".1.3.6.1.4.1.14179.2.2.2.1.15",
  "r_retry_cnt":        ".1.3.6.1.4.1.14179.2.2.6.1.3",
  "r_dup_cnt":          ".1.3.6.1.4.1.14179.2.2.6.1.5",
  "r_rts_succ_cnt":     ".1.3.6.1.4.1.14179.2.2.6.1.6",
  "r_rts_fail_cnt":     ".1.3.6.1.4.1.14179.2.2.6.1.7",
  "r_ack_fail_cnt":     ".1.3.6.1.4.1.14179.2.2.6.1.8",
  "r_fcs_error_cnt":    ".1.3.6.1.4.1.14179.2.2.6.1.11",
  "r_d11_fail_cnt":     ".1.3.6.1.4.1.14179.2.2.6.1.33",
  //per AP nei
  "cdp_nei_name":            ".1.3.6.1.4.1.9.9.623.1.3.1.1.6",
  "cdp_nei_address_type":    ".1.3.6.1.4.1.9.9.623.1.3.1.1.7",
  "cdp_nei_if_name":         ".1.3.6.1.4.1.9.9.623.1.3.1.1.9",
  "cdp_nei_if_speed":        ".1.3.6.1.4.1.9.9.623.1.3.1.1.16",
  "cdp_nei_platform":        ".1.3.6.1.4.1.9.9.623.1.3.1.1.12",
  "cdp_nei_caps":            ".1.3.6.1.4.1.9.9.623.1.3.1.1.13",
  //wlc
  "wlc_ssid":                   ".1.3.6.1.4.1.14179.2.1.1.1.2",
  //clients
  "cl_ip":                  ".1.3.6.1.4.1.14179.2.1.4.1.2",
  "cl_user":                ".1.3.6.1.4.1.14179.2.1.4.1.3",
  "cl_ap_radio":            ".1.3.6.1.4.1.14179.2.1.4.1.5",
  "cl_ssid":                ".1.3.6.1.4.1.14179.2.1.4.1.6",
  "cl_status":              ".1.3.6.1.4.1.14179.2.1.4.1.9",
  //"cl_auth_algo":           ".1.3.6.1.4.1.14179.2.1.4.1.19", //useless
  "cl_pol_state":           ".1.3.6.1.4.1.14179.2.1.4.1.23",
  "cl_pol_status":          ".1.3.6.1.4.1.14179.2.1.4.1.24", //0 - authenticated, 1 - not authenticated
  "cl_radio":               ".1.3.6.1.4.1.14179.2.1.4.1.25",
  "cl_int":                 ".1.3.6.1.4.1.14179.2.1.4.1.27",
  "cl_vlan":                ".1.3.6.1.4.1.14179.2.1.4.1.29",
  "cl_pol_type":            ".1.3.6.1.4.1.14179.2.1.4.1.30",
  "cl_cypher":              ".1.3.6.1.4.1.14179.2.1.4.1.31",
  "cl_eap_type":            ".1.3.6.1.4.1.14179.2.1.4.1.32",
  "cl_rssi":                ".1.3.6.1.4.1.14179.2.1.6.1.1",
  "cl_bytes_rx":            ".1.3.6.1.4.1.14179.2.1.6.1.2",
  "cl_bytes_tx":            ".1.3.6.1.4.1.14179.2.1.6.1.3",
  "cl_pol_errors":          ".1.3.6.1.4.1.14179.2.1.6.1.4",
  "cl_pkts_rx":             ".1.3.6.1.4.1.14179.2.1.6.1.5",
  "cl_pkts_tx":             ".1.3.6.1.4.1.14179.2.1.6.1.6",
  "cl_snr":                 ".1.3.6.1.4.1.14179.2.1.6.1.26",
  "cl_data_retries":        ".1.3.6.1.4.1.9.9.599.1.4.1.1.1",
  "cl_dup_pkts":            ".1.3.6.1.4.1.9.9.599.1.4.1.1.3",
  "cl_uptime":              ".1.3.6.1.4.1.9.9.599.1.3.1.1.15",
  "cl_rate":                ".1.3.6.1.4.1.9.9.599.1.3.1.1.17",
}

var ap_graph_keys_g = [...]string{"ap_uptime"}
var ap_graph_radio_keys_g = [...]string{"r_state", "r_users"}
var ap_graph_radio_keys_c = [...]string{"r_ack_fail_cnt", "r_d11_fail_cnt", "r_dup_cnt", "r_fcs_error_cnt", "r_retry_cnt", "r_rts_fail_cnt", "r_rts_succ_cnt"}

var client_graph_keys_g = [...]string{"cl_uptime", "cl_rssi", "cl_snr"}
var client_graph_keys_c = [...]string{"cl_bytes_rx", "cl_bytes_tx", "cl_data_retries", "cl_dup_pkts", "cl_pkts_rx", "cl_pkts_tx"}

var wlc_graph_keys_g = [...]string{"delay", "duration", "aps", "clients", "auth_clients"}

func dump(data interface{}){
    b,_:=json.MarshalIndent(data, "", "  ")
    fmt.Print(string(b))
}

var ap_keys = make([]string, 0)
var ap_radio_keys = make([]string, 0)
var ap_cdp_keys = make([]string, 0)
var client_keys = make([]string, 0)
var wlc_keys = make([]string, 0)

type histLogEntry struct {
  Type string
  Event string
  Subject string
  Time int64
  Info string
}

func init() {
  ap_keys_reg := regexp.MustCompile("^ap_")
  ap_radio_keys_reg := regexp.MustCompile("^r_")
  ap_cdp_keys_reg := regexp.MustCompile("^cdp_")
  client_keys_reg := regexp.MustCompile("^cl_")

  for key, _ := range wlc_singles {
    wlc_keys = append(wlc_keys, key)
  }

  for key, _ := range wlc_uint_tables {
    if ap_cdp_keys_reg.MatchString(key) {
      ap_cdp_keys = append(ap_cdp_keys, key)
    } else if ap_radio_keys_reg.MatchString(key) {
      ap_radio_keys = append(ap_radio_keys, key)
    } else if ap_keys_reg.MatchString(key) {
      ap_keys = append(ap_keys, key)
    } else if client_keys_reg.MatchString(key) {
      client_keys = append(client_keys, key)
    }
  }

  for key, _ := range wlc_hex_tables {
    if ap_cdp_keys_reg.MatchString(key) {
      ap_cdp_keys = append(ap_cdp_keys, key)
    } else if ap_radio_keys_reg.MatchString(key) {
      ap_radio_keys = append(ap_radio_keys, key)
    } else if ap_keys_reg.MatchString(key) {
      ap_keys = append(ap_keys, key)
    } else if client_keys_reg.MatchString(key) {
      client_keys = append(client_keys, key)
    }
  }

  for key, _ := range wlc_tables {
    if ap_cdp_keys_reg.MatchString(key) {
      ap_cdp_keys = append(ap_cdp_keys, key)
    } else if ap_radio_keys_reg.MatchString(key) {
      ap_radio_keys = append(ap_radio_keys, key)
    } else if ap_keys_reg.MatchString(key) {
      ap_keys = append(ap_keys, key)
    } else if client_keys_reg.MatchString(key) {
      client_keys = append(client_keys, key)
    }
  }

}

func Ip2long(ipAddr string) (uint32, error) {
	ip := net.ParseIP(ipAddr)
	if ip == nil {
		return 0, errors.New("wrong ipAddr format")
	}
	ip = ip.To4()
	return binary.BigEndian.Uint32(ip), nil
}

func Long2ip(ipLong uint32) string {
	ipByte := make([]byte, 4)
	binary.BigEndian.PutUint32(ipByte, ipLong)
	ip := net.IP(ipByte)
	return ip.String()
}

func get_site(ip string) string {
  if ip == "0.0.0.0" || ip == "" {
    return "null"
  }
  longIP, ip2long_err := Ip2long(ip)
  if ip2long_err != nil {
    return "error"
  }
  if site, site_exists := globalSites[longIP]; site_exists {
    return site.Site
  }

  for _, si := range globalSites {
    if longIP >= si.First  && longIP <= si.Last {
      return si.Site
    }
  }

  return "nosite"
}

func get_netname(ip string) string {
  if ip == "0.0.0.0" || ip == "" {
    return "null"
  }
  longIP, ip2long_err := Ip2long(ip)
  if ip2long_err != nil {
    return "error"
  }
  if site, site_exists := globalSites[longIP]; site_exists {
    return site.Netname
  }

  for _, si := range globalSites {
    if longIP >= si.First  && longIP <= si.Last {
      return si.Netname
    }
  }

  return "nosite"
}

func worker(dev_ip string, wg *sync.WaitGroup, stop_ch chan struct{}) {
  var err error
  var snmp_client *snmp.GoSNMP

  var red redis.Conn
  red_ok := true

  defer func() {
    if snmp_client.Conn != nil {
      snmp_client.Conn.Close()
      snmp_client.Conn = nil
    }

    if red != nil {
      red.Close()
      red = nil
    }

    wg.Done()
  }()

  globalMutex.Lock()
  if _, ok := globalWlcs[dev_ip]; !ok {
    globalWlcs[dev_ip] = &wlcInfo{}
    globalWlcs[dev_ip].Ssids = make(map[string]string)
    globalWlcs[dev_ip].Attrs = make(map[string]string)
    globalWlcs[dev_ip].Status = "startup"

    rrd_file := config.Options.RRD_base_dir+"wlcs/"+dev_ip+".rrd"
    if _, stat_err := os.Stat(rrd_file); stat_err == nil {
      globalWlcs[dev_ip].RRD_file = true
    }

    globalWlcs[dev_ip].Site = get_site(dev_ip)
    globalWlcs[dev_ip].Netname = get_netname(dev_ip)
  }
  globalMutex.Unlock()


  snmp_client = &snmp.GoSNMP{
    Target:    dev_ip,
    Port:      uint16(161),
    Community: "public",
    Version:   snmp.Version2c,
    Timeout:   time.Duration(config.Options.Snmp_timeout) * time.Second,
    Retries:   config.Options.Snmp_retries,
    MaxRepetitions: config.Options.Snmp_max_repetitions,
//    Logger:    log.New(os.Stdout, "", 0),
  }


  var snmp_ok=true

  var cycle_start time.Time

  first_scan := true

  rrd_ok := true

  var prev_now int64 = 0

  WORKER_CYCLE: for {

    globalMutex.Lock()
    globalWlcs[dev_ip].Site = get_site(dev_ip)
    globalWlcs[dev_ip].Netname = get_netname(dev_ip)
    globalMutex.Unlock()

    rrd_queue := make([]string, 0)

    rrd_file := config.Options.RRD_base_dir+"wlcs/"+dev_ip+".rrd"
    if _, stat_err := os.Stat(rrd_file); stat_err != nil {
      cmd := "CREATE "+rrd_file+config.Options.Rrd_wlc_create_prefix
      for _, key := range wlc_graph_keys_g {
        cmd += " DS:"+key+":GAUGE:"
        cmd += config.Options.Rrd_wlc_heartbeat
        cmd += ":U:U"
      }
      rrd_queue = append(rrd_queue, cmd)
      globalWlcs[dev_ip].RRD_file = false
    } else {
      globalWlcs[dev_ip].RRD_file = true
    }

    cycle_start = time.Now()
    var scan_data_singles = make(map[string]string)
    var scan_data_tables = make(map[string]map[string]string)

    wlc_stats := make(map[string]int64)

    if snmp_client.Conn == nil {
      err = snmp_client.Connect()
      if err != nil {
        snmp_client.Conn = nil
        if snmp_ok {
          logError("worker: "+dev_ip, "connect error: "+err.Error())
        }
        snmp_ok = false
      } else {
        if !snmp_ok {
          logError("worker: "+dev_ip, "connected")
        }
        snmp_ok = true
      }
    }

    first_reply := false

    if snmp_client.Conn != nil {

      for key, oid := range wlc_singles {
        var val string

        val, err = getOneStop(snmp_client, oid, vtString, stop_ch)
        if err != nil {
          if snmp_ok {
            if err.Error() != "Interrupted" {
              logError("worker: "+dev_ip, "get \""+key+"\" error: "+err.Error())
            }
          }
          snmp_ok = false
          goto WORKER_SLEEP
        }

        if !first_reply  {
          first_reply = true

          wlc_stats["delay"] = time.Now().Sub(cycle_start).Milliseconds()
        }

        scan_data_singles[key] = val

        globalMutex.Lock()
        globalWlcs[dev_ip].Last_seen = time.Now().Unix()
        globalMutex.Unlock()
      }

      for key, oid := range wlc_uint_tables {
        var val map[string]string

        val, err = getTableFuncStop(snmp_client, oid, vtUns,
          func() {
            globalMutex.Lock()
            globalWlcs[dev_ip].Last_seen = time.Now().Unix()
            globalMutex.Unlock()
          },
          stop_ch)

        if err != nil {
          if err.Error() != "NoSuchInstance" {
            if snmp_ok {
              logError("worker: "+dev_ip, "get table \""+key+"\" error: "+err.Error())
            }
            snmp_ok = false
            goto WORKER_SLEEP
          } else {
            err = nil
            val = make(map[string]string)
          }
        }

        scan_data_tables[key] = val
      }

      for key, oid := range wlc_hex_tables {
        var val map[string]string

        val, err = getTableFuncStop(snmp_client, oid, vtHex,
          func() {
            globalMutex.Lock()
            globalWlcs[dev_ip].Last_seen = time.Now().Unix()
            globalMutex.Unlock()
          },
          stop_ch)

        if err != nil {
          if err.Error() != "NoSuchInstance" {
            if snmp_ok {
              logError("worker: "+dev_ip, "get table \""+key+"\" error: "+err.Error())
            }
            snmp_ok = false
            goto WORKER_SLEEP
          } else {
            err = nil
            val = make(map[string]string)
          }
        }

        scan_data_tables[key] = val
      }

      for key, oid := range wlc_tables {
        var val map[string]string
        val, err = getTableFuncStop(snmp_client, oid, vtString,
          func() {
            globalMutex.Lock()
            globalWlcs[dev_ip].Last_seen = time.Now().Unix()
            globalMutex.Unlock()
          },
          stop_ch)

        if err != nil {
          if err.Error() != "NoSuchInstance" {
            if snmp_ok {
              logError("worker: "+dev_ip, "get table \""+key+"\" error: "+err.Error())
            }
            snmp_ok = false
            goto WORKER_SLEEP
          } else {
            err = nil
            val = make(map[string]string)
          }
        }

        scan_data_tables[key] = val
      }

      // snmp scan done

      wlc_stats["duration"] = time.Now().Sub(cycle_start).Milliseconds()

      //fmt.Println("got data from", dev_ip)


      globalMutex.Lock()

      globalMutex.Unlock()
    }

    WORKER_SLEEP:

    var red_err error

    if red != nil {
      _, red_err = red.Do("PING")
      if red_err != nil {
        red.Close()
        red = nil
      }
    }

    if red == nil {
      red, red_err = redis.Dial(config.Options.Redis_conn_type, config.Options.Redis_conn_address, redis.DialDatabase(config.Options.Redis_db))
      if red_err != nil {
        red = nil
        if red_ok {
          logError("worker: "+dev_ip, "Redis Dial error: "+red_err.Error())
        }
        red_ok = false
      } else {
        if !red_ok {
          logError("worker: "+dev_ip, "Redis connected")
        }
        red_ok = true
      }
    }

    globalMutex.Lock()

    globalWlcs[dev_ip].Stats = make(map[string]int64)

    var prev_globalAps map[string]*apInfo

    if rperr := reprint.FromTo(&globalAps, &prev_globalAps); rperr != nil {
      panic(rperr.Error())
    }

    var prev_globalClients map[string]*clientInfo

    if rperr := reprint.FromTo(&globalClients, &prev_globalClients); rperr != nil {
      panic(rperr.Error())
    }

    apJsons := make(map[string]string)

    hist_log := make([]histLogEntry, 0)

    now := time.Now().Unix()
    if now == prev_now {
      //long previous run, short sleep after
      now++
    }

    prev_now = now

    if err == nil {
      globalWlcs[dev_ip].Last_ok = now
      globalWlcs[dev_ip].Status = "ok"
      globalWlcs[dev_ip].Error = ""
      // process raw data

      globalWlcs[dev_ip].Ssids = make(map[string]string)

      for ssid_num, ssid_name := range scan_data_tables["wlc_ssid"] {
        globalWlcs[dev_ip].Ssids[ssid_num] = ssid_name
      }

      globalWlcs[dev_ip].Attrs = make(map[string]string)
      for _, key := range wlc_keys {
        if val, exists := scan_data_singles[key]; exists {
          globalWlcs[dev_ip].Attrs[key] = val
        }
      }

      wlc_stats["aps"] = 0
      wlc_stats["clients"] = 0
      wlc_stats["auth_clients"] = 0

      //aps
      if _, mac_table_exists := scan_data_tables["ap_mac"]; mac_table_exists {
        for _, ap_mac := range scan_data_tables["ap_mac"] {
          ap_global_index := ap_mac+"@"+dev_ip
          if _, ap_exists := globalAps[ap_global_index]; !ap_exists {
            globalAps[ap_global_index] = &apInfo{
              added: now,
              Wlc: dev_ip,
              Mac: ap_mac,
              Attrs: make(map[string]string),
              RadioAttrs: make(map[string]map[string]string),
              CdpNeiAttrs: make(map[string]map[string]string),
            }
          }

          globalAps[ap_global_index].Last_ok = now
          globalAps[ap_global_index].keys_check = 0
        }

        for _, key := range ap_keys {
          if _, key_exists := scan_data_tables[key]; key_exists {
            for ap_index, value := range scan_data_tables[key] {
              if ap_mac, ap_mac_exists := scan_data_tables["ap_mac"][ap_index]; ap_mac_exists {
                ap_global_index := ap_mac+"@"+dev_ip
                globalAps[ap_global_index].Attrs[key] = value
                globalAps[ap_global_index].keys_check ++
              }
            }
          }
        }

        for _, key := range ap_radio_keys {
          if _, key_exists := scan_data_tables[key]; key_exists {
            for ap_radio_index, value := range scan_data_tables[key] {
              radio_index_pos := strings.LastIndex(ap_radio_index, ".")
              ap_index := ap_radio_index[0:radio_index_pos]
              radio_index := ap_radio_index[radio_index_pos+1:]

              if ap_mac, ap_mac_exists := scan_data_tables["ap_mac"][ap_index]; ap_mac_exists && len(radio_index) > 0 {
                ap_global_index := ap_mac+"@"+dev_ip
                if _, radio_exists := globalAps[ap_global_index].RadioAttrs[radio_index]; !radio_exists {
                  globalAps[ap_global_index].RadioAttrs[radio_index] = make(map[string]string)
                }
                globalAps[ap_global_index].RadioAttrs[radio_index][key] = value
                globalAps[ap_global_index].keys_check ++
              }
            }
          }
        }

        for _, key := range ap_cdp_keys {
          if _, key_exists := scan_data_tables[key]; key_exists {
            for ap_cdp_index, value := range scan_data_tables[key] {
              cdp_index_pos := strings.LastIndex(ap_cdp_index, ".")
              ap_index := ap_cdp_index[0:cdp_index_pos]
              cdp_index := ap_cdp_index[cdp_index_pos+1:]

              if ap_mac, ap_mac_exists := scan_data_tables["ap_mac"][ap_index]; ap_mac_exists && len(cdp_index) > 0 {
                ap_global_index := ap_mac+"@"+dev_ip
                if _, cdp_exists := globalAps[ap_global_index].CdpNeiAttrs[cdp_index]; !cdp_exists {
                  globalAps[ap_global_index].CdpNeiAttrs[cdp_index] = make(map[string]string)
                }
                if key == "cdp_nei_address" && len(value) == 8 {
                  o1,e1 := strconv.ParseUint(value[0:2], 16, 8)
                  o2,e2 := strconv.ParseUint(value[2:4], 16, 8)
                  o3,e3 := strconv.ParseUint(value[4:6], 16, 8)
                  o4,e4 := strconv.ParseUint(value[6:8], 16, 8)
                  if e1 == nil && e2 == nil && e3 == nil && e4 == nil {
                    value=fmt.Sprintf("%d.%d.%d.%d", o1, o2, o3, o4)
                  }
                }
                globalAps[ap_global_index].CdpNeiAttrs[cdp_index][key] = value
                globalAps[ap_global_index].keys_check ++
              }
            }
          }
        }
      }

     //clients

      if _, mac_table_exists := scan_data_tables["cl_mac"]; mac_table_exists {
        for _, client_mac := range scan_data_tables["cl_mac"] {
          client_global_index := client_mac+"@"+dev_ip
          if _, client_exists := globalClients[client_global_index]; !client_exists {
            globalClients[client_global_index] = &clientInfo{
              added: now,
              Wlc: dev_ip,
              Mac: client_mac,
              Attrs: make(map[string]string),
            }
          }

          globalClients[client_global_index].check = now
          globalClients[client_global_index].keys_check = 0
        }

        for _, key := range client_keys {
          if _, key_exists := scan_data_tables[key]; key_exists {
            for client_index, value := range scan_data_tables[key] {
              if client_mac, client_mac_exists := scan_data_tables["cl_mac"][client_index]; client_mac_exists {
                client_global_index := client_mac+"@"+dev_ip
                if key == "cl_user" {
                  globalClients[client_global_index].Attrs[key] = strings.ToLower(value)
                } else {
                  globalClients[client_global_index].Attrs[key] = value
                }
                globalClients[client_global_index].keys_check++
              }
            }
          }
        }
      }

      // process parsed data

      for client_index, client := range globalClients {
        if client.Wlc == dev_ip {
          rrd_file := config.Options.RRD_base_dir+"clients/"+client_index+".rrd"
          if _, stat_err := os.Stat(rrd_file); stat_err != nil {
            cmd := "CREATE "+rrd_file+config.Options.Rrd_client_create_prefix
            for _, key := range client_graph_keys_g {
              cmd += " DS:"+key+":GAUGE:"
              cmd += config.Options.Rrd_client_heartbeat
              cmd += ":U:U"
            }
            for _, key := range client_graph_keys_c {
              cmd += " DS:"+key+":COUNTER:"
              cmd += config.Options.Rrd_client_heartbeat
              cmd += ":0:U"
            }
            rrd_queue = append(rrd_queue, cmd)
          } else {
            globalClients[client_index].RRD_file = true
          }
          if client.check != now {
            //client gone
            // TODO: log this event (queue for logging after unlock)

            if !first_scan {
              json, jerr := json.MarshalIndent(client, "", "\t")
              if jerr != nil {
                json = []byte("json_error")
              }
              hist_log = append(hist_log, histLogEntry{ "mac", "disconnect", client.Mac, now, string(json) })
              if client.Attrs["cl_user"] != "" && client.Attrs["cl_pol_status"] == "0" {
                hist_log = append(hist_log, histLogEntry{ "user", "disconnect", client.Attrs["cl_user"], now, string(json) })
              }
            }

            //push UNKNOWN values for graph keys to prevent spikes
            cmd := "UPDATE " + rrd_file + fmt.Sprintf(" %d", now)
            for _ = range client_graph_keys_g {
              cmd += ":U"
            }
            for _ = range client_graph_keys_c {
              cmd += ":U"
            }
            rrd_queue = append(rrd_queue, cmd)

            delete(globalClients, client_index)
          } else if client.keys_check != len(client_keys) {
            //incomplete data
            delete(globalClients, client_index)
          } else {

            client.Mac_info = make([]macInfo, 0)
            client.Attrs["cl_ssid_name"] = ""

            //find out client's possible username
            if _, ok := globalMacInfo[ client.Mac ]; ok {
              //json, _ := json.Marshal(globalMacInfo[ client.Mac ])
              //client.Attrs["cl_mac_info"] = string(json)
              reprint.FromTo(globalMacInfo[ client.Mac ], &client.Mac_info)
            }

            //find out client's possible SSID name
            if v2, ok2 := globalWlcs[ dev_ip ].Ssids[ client.Attrs["cl_ssid"] ]; ok2 {
              client.Attrs["cl_ssid_name"] = v2
            }

            //find out client's site


            client.Attrs["cl_site"] = get_site(client.Attrs["cl_ip"])
            client.Attrs["cl_netname"] = get_netname(client.Attrs["cl_ip"])

            //get OUI info
            if client.Mac[1] == '0' || client.Mac[1] == '4' || client.Mac[1] == '8' || client.Mac[1] == 'c' {
              if vendor, vendor_exists := globalOui[ client.Mac[0:6] ]; vendor_exists {
                client.Attrs["cl_vendor"] = vendor
              } else {
                client.Attrs["cl_vendor"] = "Unknown"
              }
            } else {
              client.Attrs["cl_vendor"] = "Random"
            }

            if !first_scan {
              if client.added == client.check {
                //client just appeared
                // TODO: log this event (queue for logging after unlock)
                json, jerr := json.MarshalIndent(client, "", "\t")
                if jerr != nil {
                  json = []byte("json_error")
                }
                hist_log = append(hist_log, histLogEntry{ "mac", "connect", client.Mac, now, string(json) })
                if client.Attrs["cl_user"] != "" && client.Attrs["cl_pol_status"] == "0" {
                  hist_log = append(hist_log, histLogEntry{ "user", "connect", client.Attrs["cl_user"], now, string(json) })
                }
              } else {
                // check for client AP migration, auth status change
                prev_client, prev_client_ex := prev_globalClients[client_index]
                if prev_client_ex {
                  if client.Attrs["cl_ap_mac"] != prev_client.Attrs["cl_ap_mac"] || client.Attrs["cl_ap_radio"] != prev_client.Attrs["cl_ap_radio"] {
                    //client moved
                    json, jerr := json.MarshalIndent(
                      clientMoveInfo{ Client: client, PrevAP_MAC: prev_client.Attrs["cl_ap_mac"], PrevAP_Radio: prev_client.Attrs["cl_ap_radio"] },
                      "", "\t")
                    if jerr != nil {
                      json = []byte("json_error")
                    }
                    hist_log = append(hist_log, histLogEntry{ "mac", "roam", client.Mac, now, string(json) })
                    if client.Attrs["cl_user"] != "" && client.Attrs["cl_pol_status"] == "0" {
                      hist_log = append(hist_log, histLogEntry{ "user", "roam", client.Attrs["cl_user"], now, string(json) })
                    }
                  }
                  if client.Attrs["cl_pol_status"] != prev_client.Attrs["cl_pol_status"] {
                    json, jerr := json.MarshalIndent(client, "", "\t")
                    if jerr != nil {
                      json = []byte("json_error")
                    }
                    hist_log = append(hist_log, histLogEntry{ "mac", "auth", client.Mac, now, string(json) })
                    if client.Attrs["cl_user"] != "" && client.Attrs["cl_pol_status"] == "0" {
                      hist_log = append(hist_log, histLogEntry{ "user", "auth", client.Attrs["cl_user"], now, string(json) })
                    }
                  }
                }
              }
            }

            //queue graphs
            cmd := "UPDATE " + rrd_file + fmt.Sprintf(" %d", now)
            for _, key := range client_graph_keys_g {
              cmd += ":" + client.Attrs[key]
            }
            for _, key := range client_graph_keys_c {
              cmd += ":" + client.Attrs[key]
            }
            rrd_queue = append(rrd_queue, cmd)

            wlc_stats["clients"] ++
            if client.Attrs["cl_pol_status"] == "0" {
              wlc_stats["auth_clients"] ++
            }
          }
        }
      }

      for ap_index, ap := range globalAps {
        if ap.Wlc == dev_ip {
          rrd_file := config.Options.RRD_base_dir+"aps/"+ap_index+".rrd"
          if _, stat_err := os.Stat(rrd_file); stat_err != nil {
            cmd := "CREATE "+rrd_file+config.Options.Rrd_ap_create_prefix
            for _, key := range ap_graph_keys_g {
              cmd += " DS:"+key+":GAUGE:"
              cmd += config.Options.Rrd_ap_heartbeat
              cmd += ":U:U"
            }
            for i := 0; i < len(ap.RadioAttrs); i++ {
              is := fmt.Sprintf("%d", i)
              for _, key := range ap_graph_radio_keys_g {
                cmd += " DS:"+key+"_"+is+":GAUGE:"
                cmd += config.Options.Rrd_ap_heartbeat
                cmd += ":U:U"
              }
              for _, key := range ap_graph_radio_keys_c {
                cmd += " DS:"+key+"_"+is+":COUNTER:"
                cmd += config.Options.Rrd_ap_heartbeat
                cmd += ":0:U"
              }
            }
            rrd_queue = append(rrd_queue, cmd)
          } else {
            globalAps[ap_index].RRD_file = true
          }
          if ap.Last_ok != now {
            //ap gone
            // TODO: log this event (queue for logging after unlock)

            json, jerr := json.MarshalIndent(ap, "", "\t")
            if jerr != nil {
              json = []byte("json_error")
            }
            hist_log = append(hist_log, histLogEntry{ "ap", "disconnect", ap.Mac, now, string(json) })

            // push UNKNOWN values to rrd to prevent spikes
            cmd := "UPDATE " + rrd_file + fmt.Sprintf(" %d", now)
            for _ = range ap_graph_keys_g {
              cmd += ":U"
            }
            for i := 0; i < len(ap.RadioAttrs); i++ {
              for _ = range ap_graph_radio_keys_g {
                cmd += ":U"
              }
              for _ = range ap_graph_radio_keys_c {
                cmd += ":U"
              }
            }
            rrd_queue = append(rrd_queue, cmd)

            delete(globalAps, ap_index)
          } else if ap.keys_check != (len(ap_keys) + len(ap.RadioAttrs)*len(ap_radio_keys) + len(ap.CdpNeiAttrs)*len(ap_cdp_keys)) {
            //incomplete data

            delete(globalAps, ap_index)
          } else {

            ap.Status = "online"

            ap.Attrs["ap_site"] = get_site(ap.Attrs["ap_ip"])
            ap.Attrs["ap_netname"] = get_netname(ap.Attrs["ap_ip"])

            if !first_scan {
              if ap.added == ap.Last_ok {
                //ap just appeared
                // TODO: log this event (queue for logging after unlock)
                json, jerr := json.MarshalIndent(ap, "", "\t")
                if jerr != nil {
                  json = []byte("json_error")
                }
                hist_log = append(hist_log, histLogEntry{ "ap", "connect", ap.Mac, now, string(json) })
              }
            }

            //save in redis

            json, jerr := json.MarshalIndent(ap, "", "\t")
            if jerr == nil {
              apJsons[ ap.Mac ] = string(json)
            } else {
              apJsons[ ap.Mac ] = "error"
            }
            //queue graphs
            cmd := "UPDATE " + rrd_file + fmt.Sprintf(" %d", now)
            for _, key := range ap_graph_keys_g {
              cmd += ":"+ap.Attrs[key]
            }
            for i := 0; i < len(ap.RadioAttrs); i++ {
              is := fmt.Sprintf("%d", i)
              for _, key := range ap_graph_radio_keys_g {
                cmd += ":"+ap.RadioAttrs[is][key]
              }
              for _, key := range ap_graph_radio_keys_c {
                cmd += ":"+ap.RadioAttrs[is][key]
              }
            }
            rrd_queue = append(rrd_queue, cmd)

            wlc_stats["aps"] ++
          }
        }
      }

      first_scan = false

      cmd := "UPDATE " + rrd_file + fmt.Sprintf(" %d", now)
      for _, key := range wlc_graph_keys_g {
        if _, ok := wlc_stats[ key ]; !ok {
          panic("No key in wlc_stats: "+key);
        }
        cmd += ":" + fmt.Sprintf("%d", wlc_stats[ key ])
      }
      rrd_queue = append(rrd_queue, cmd)

      if rperr := reprint.FromTo(&wlc_stats, &globalWlcs[dev_ip].Stats); rperr != nil {
        panic(rperr.Error())
      }

    } else {
      globalWlcs[dev_ip].Status = "error"
      globalWlcs[dev_ip].Error = err.Error()

      cmd := "UPDATE " + rrd_file + fmt.Sprintf(" %d", now)
      for _ = range wlc_graph_keys_g {
        cmd += ":U"
      }
      rrd_queue = append(rrd_queue, cmd)
    }

    globalMutex.Unlock()

    if len(apJsons) > 0 {
      if red != nil && err == nil {

AP_REDIS_CYCLE: for ap_mac, ap_json := range apJsons {
          _, err = red.Do("SET", "ap_data_"+ap_mac, ap_json)
          if err != nil {
            break AP_REDIS_CYCLE
          }
          _, err = red.Do("SET", "ap_last_ok_"+ap_mac, now)
          if err != nil {
            break AP_REDIS_CYCLE
          }
          _, err = red.Do("SET", "ap_wlc_"+ap_mac, dev_ip)
          if err != nil {
            break AP_REDIS_CYCLE
          }
        }

        if err == nil {
          json, jerr := json.MarshalIndent(globalWlcs[dev_ip], "", "\t")
          if jerr == nil {
            _, err = red.Do("SET", "wlc_"+dev_ip, string(json))
            if err == nil {
              _, err = red.Do("SET", "wlc_last_ok_"+dev_ip, globalWlcs[dev_ip].Last_ok)
            }
          }
        }

        if err != nil {
          red.Close()
          red = nil
          if red_ok {
            logError("worker: "+dev_ip, "Redis set error: "+err.Error())
          }
          red_ok = false
        }
      }
    }

    //push to rrd

    if len(rrd_queue) > 0 {
      rrdc, rrdc_err := rrd.NewClient(config.Options.RRD_socket, rrd.Unix)
      if rrdc_err != nil {
        if rrd_ok {
          logError("worker: "+dev_ip, "RRD connect error: "+rrdc_err.Error())
        }
        rrd_ok = false
        rrdc = nil
      } else {
        if !rrd_ok {
          logError("worker: "+dev_ip, "RRD connect ok")
        }
        rrd_ok = true
      }

      if rrd_ok {
        for _, cmd := range rrd_queue {
          _, rrd_err := rrdc.Exec(cmd)
          if rrd_err != nil {
            logError("worker: "+dev_ip, "RRD command error: "+rrd_err.Error())
            logError("\t", "Command was\n"+cmd+"\n")
            rrd_ok = false
            break
          }
        }
        rrdc.Close()
        rrdc = nil
      }
    }

    if red != nil && red_ok && len(hist_log) > 0 {
      var red_err error
      etypes_trim := make(map[string]int)
      for _, e := range hist_log {
        etime := fmt.Sprintf("%d", e.Time)

        //debug logs
        if _, red_err = red.Do("PUBLISH", "log", etime+"\t"+e.Type+"\t"+e.Event+"\t"+e.Subject+"\t"+e.Info); red_err != nil {
          break
        }
        if _, red_err = red.Do("PUBLISH", "log_"+e.Type, etime+"\t"+e.Event+"\t"+e.Subject+"\t"+e.Info); red_err != nil {
          break
        }
        if _, red_err = red.Do("PUBLISH", "log_"+e.Type+"_"+e.Subject, etime+"\t"+e.Event+"\t"+e.Info); red_err != nil {
          break
        }

        //global event logs
        if _, red_err = red.Do("LPUSH", "events_"+e.Type, etime+"\t"+e.Event+"\t"+e.Subject+"\t"+e.Info); red_err != nil {
          break
        } else {
          etypes_trim["events_"+e.Type] = 1
        }

        if _, red_err = red.Do("LPUSH", "events_"+e.Type+"_"+e.Subject, etime+"\t"+e.Event+"\t"+e.Info); red_err != nil {
          break
        }

        if _, red_err = red.Do("LTRIM", "events_"+e.Type+"_"+e.Subject, 0, config.Options.Redis_subject_events_trim); red_err != nil {
          break
        }

        //per subject event log
      }

      if red_err == nil {
        for key, _ := range etypes_trim {
          if _, red_err = red.Do("LTRIM", key, 0, config.Options.Redis_global_events_trim); red_err != nil {
            break
          }
        }
      }

      if red_err != nil {
        red.Close()
        red = nil
        if red_ok {
          logError("worker: "+dev_ip, "Redis error: "+red_err.Error())
        }
        red_ok = false
      }
    }

    var worker_timer *time.Timer

    if err == nil {
      worker_timer = time.NewTimer( time.Until(cycle_start.Add( time.Duration(config.Options.Snmp_scan_period) * time.Second )) )
    } else {
      worker_timer = time.NewTimer( time.Duration(config.Options.Error_sleep_time) * time.Second )
    }

    select {
    case <-stop_ch:
      if !worker_timer.Stop() {
        <-worker_timer.C
      }
      break WORKER_CYCLE
    case <-worker_timer.C:
      //continue working
    }
  }
}
