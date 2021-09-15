package main

import (
  "fmt"
  "encoding/json"
  "io/ioutil"
  "os"
  "os/signal"
  "syscall"
  "regexp"
  "sync"
  "time"
  "runtime"
)

const DEFAULT_CONF_FILE="/etc/gowlcd/gowlcd.conf"

const IP_REGEX=`^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$`
var ip_reg *regexp.Regexp

const MAC_REGEX=`^[0-9a-f]{12}$`
var mac_reg *regexp.Regexp

const UINT_REGEX=`^\d+$`
var uint_reg *regexp.Regexp

const USER_REGEX=`^[0-9a-zA-Z\._\-]+(?:@[0-9a-zA-Z\._\-]+)?$`
var user_reg *regexp.Regexp

func PrintMemUsage() {
  var m runtime.MemStats
  runtime.ReadMemStats(&m)
  // For info on each, see: https://golang.org/pkg/runtime/#MemStats
  fmt.Printf("Alloc = %v MiB", bToMb(m.Alloc))
  //fmt.Printf("\tTotalAlloc = %v MiB", bToMb(m.TotalAlloc))
  fmt.Printf("\tSys = %v MiB", bToMb(m.Sys))
  //fmt.Printf("\tNumGC = %v", m.NumGC)
  fmt.Print("\n")
}

func bToMb(b uint64) uint64 {
  return b / 1024 / 1024
}

type conf_wlcs struct {
  Enabled        int          `json:"enabled"`
  Community      string       `json:"community"`
}

type conf_options struct {
  Bootstrap_timeout      int64     `json:"bootstrap_timeout"`
  Snmp_timeout      int     `json:"snmp_timeout"`
  Snmp_retries      int     `json:"snmp_retries"`
  Snmp_max_repetitions uint32  `json:"snmp_max_repetitions"`
  Snmp_scan_period int64  `json:"snmp_scan_period"`
  Db_refresh_period int64  `json:"db_refresh_period"`
  Error_sleep_time int64  `json:"error_sleep_time"`
  Wifi_db_dsn string  `json:"wifi_db_dsn"`
  Ipdb_db_dsn string  `json:"ipdb_db_dsn"`
  Redis_conn_type string  `json:"redis_conn_type"`
  Redis_conn_address string `json:"redis_conn_address"`
  Redis_db int `json:"redis_db"`
  Redis_timeout int64  `json:"redis_timeout"`
  Redis_global_events_trim uint64 `json:"rrd_global_events_trim"`
  Redis_subject_events_trim uint64 `json:"rrd_global_events_trim"`
  Http_server_addr string   `json:"http_server_addr"`
  Http_max_conn int   `json:"http_max_conn"`
  Http_server_root string `json:"http_server_root"`
  RRD_base_dir string `json:"rrd_base_dir"`
  RRD_socket string `json:"rrd_socket"`
  Rrd_wlc_create_prefix string `json:"rrd_wlc_create_prefix"`
  Rrd_wlc_heartbeat string `json:"rrd_wlc_create_heartbeat"`
  Rrd_ap_create_prefix string `json:"rrd_ap_create_prefix"`
  Rrd_ap_heartbeat string `json:"rrd_ap_heartbeat"`
  Rrd_client_create_prefix string `json:"rrd_client_create_prefix"`
  Rrd_client_heartbeat string `json:"rrd_client_heartbeat"`
  Oui_url string `json:"oui_url"`
  Oui_refresh_period int64  `json:"oui_refresh_period"`
  Oui_error_sleep int64  `json:"oui_error_sleep"`
  Oui_timeout int64 `json:"oui_timeout"`
  Traps_mib_dirs []string `json:"traps_mib_dirs"`
  Traps_mib_modules []string `json:"traps_mib_modules"`
  Traps_listen string `json:"traps_listen"`
  Traps_keys_user []string `json:"traps_keys_user"`
  Traps_keys_mac []string `json:"traps_keys_mac"`
  Traps_keys_ap []string `json:"traps_keys_ap"`
  _end int8
}

type conf struct {
  Wlcs      map[string]conf_wlcs     `json:"wlcs"`
  Options   conf_options    `json:"options"`
}

var config = conf{
  Options: conf_options{
    Bootstrap_timeout: 10,
    Snmp_timeout: 10,
    Snmp_retries: 3,
    Snmp_max_repetitions: 10,
    Snmp_scan_period: 30,
    Db_refresh_period: 60,
    Error_sleep_time: 10,
    Wifi_db_dsn: "gowlcd:gowlcd@/cards",
    Redis_conn_type: "tcp",
    Redis_conn_address: ":6379",
    Redis_db: 1,
    Redis_timeout: 5,
    Redis_global_events_trim: 1000,
    Redis_subject_events_trim: 100,
    Http_server_addr: ":8081",
    Http_server_root: "/var/lib/gowlcd-www",
    Http_max_conn: 1000,
    RRD_base_dir: "/var/lib/rrdcached/db/gowlcd/",
    RRD_socket: "/var/run/rrdcached.socket",
    Rrd_wlc_create_prefix:    " -O -step 60 RRA:LAST:0.5:1m:2d RRA:AVERAGE:0.5:5m:1w RRA:AVERAGE:0.5:1h:6M",
    Rrd_wlc_heartbeat:                  "90",
    Rrd_ap_create_prefix:     " -O -step 180 RRA:LAST:0.5:3m:2d RRA:AVERAGE:0.5:15m:1w RRA:AVERAGE:0.5:1h:6M",
    Rrd_ap_heartbeat:                   "270",
    Rrd_client_create_prefix: " -O -step 180 RRA:LAST:0.5:3m:2d RRA:AVERAGE:0.5:15m:1w RRA:AVERAGE:0.5:1h:6M",
    Rrd_client_heartbeat:               "270",
    Oui_refresh_period: 3600*24, //once per day
    Oui_error_sleep: 300, //5 minutes
    Oui_timeout: 30, //30 seconds
    Traps_mib_dirs: []string{"/etc/gowlcd/mibs"},
    Traps_mib_modules: []string{"CISCO-LWAPP-RRM-MIB", "AIRESPACE-WIRELESS-MIB", "CISCO-LWAPP-AP-MIB",
                                "CISCO-LWAPP-DOT11-CLIENT-MIB", "CISCO-LWAPP-EXT-MIB", "CISCO-LWAPP-ROGUE-MIB",
                                "CISCO-FIPS-STATS-MIB", "CISCO-LWAPP-WLAN-MIB"},
    Traps_listen: "0.0.0.0:162",
    Traps_keys_user: []string{"cldcClientUsername", "bsnStationUserName"},
    Traps_keys_mac: []string{"cldcClientMacAddress", "bsnStationMacAddress"},
    _end: 1} }

func waitTimeout(wg *sync.WaitGroup, timeout time.Duration) bool {
  c := make(chan struct{})
  go func() {
    defer close(c)
    wg.Wait()
  }()

  select {
    case <-c:
      return false // completed normally
    case <-time.After(timeout):
      return true // timed out
  }
}

func logError(source string, message string) {
  fmt.Fprintln(os.Stderr, source, message)
}

func init() {

  ip_reg = regexp.MustCompile(IP_REGEX)
  mac_reg = regexp.MustCompile(MAC_REGEX)
  uint_reg = regexp.MustCompile(UINT_REGEX)
  user_reg = regexp.MustCompile(USER_REGEX)

  conf_bytes, err := ioutil.ReadFile(DEFAULT_CONF_FILE)
  if err != nil { fmt.Fprintln(os.Stderr, "Error reading config file "+DEFAULT_CONF_FILE); fmt.Fprintln(os.Stderr, err.Error()); os.Exit(1); }

  err = json.Unmarshal(conf_bytes, &config)
  if err != nil { fmt.Fprintln(os.Stderr, "Error decoding config file "+DEFAULT_CONF_FILE); fmt.Fprintln(os.Stderr, err.Error()); os.Exit(1); }

  if len(config.Wlcs) == 0 {
    fmt.Fprintln(os.Stderr, "No WLCs in config, nothing to do")
    os.Exit(1)
  }

  for ip, wlc := range config.Wlcs {
    if !ip_reg.MatchString(ip) {
      fmt.Fprintln(os.Stderr, "Bad WLC IP in config: "+ip)
      os.Exit(1)
    }
    if wlc.Community == "" {
      wlc.Community = "public"
      config.Wlcs[ip] = wlc
    }
  }

}

func main() {
  conf_json, _ := json.MarshalIndent(config, "", "  ")
  fmt.Println(string(conf_json))

  sig_ch := make(chan os.Signal, 1)
  signal.Notify(sig_ch, syscall.SIGHUP)
  signal.Notify(sig_ch, syscall.SIGINT)
  signal.Notify(sig_ch, syscall.SIGTERM)
  signal.Notify(sig_ch, syscall.SIGQUIT)
  signal.Notify(sig_ch, syscall.SIGUSR1)

  var wg sync.WaitGroup
  var boot_wg sync.WaitGroup

  stop_ch := make(chan struct{}, 1)

  if config.Options.Wifi_db_dsn != "" {
    wg.Add(1)
    boot_wg.Add(1)
    go mac2user(&wg, &boot_wg, stop_ch)
  }

  if config.Options.Ipdb_db_dsn != "" {
    wg.Add(1)
    boot_wg.Add(1)
    go ipdb(&wg, &boot_wg, stop_ch)
  }

  if config.Options.Oui_url != "" {
    wg.Add(1)
    boot_wg.Add(1)
    go oui(&wg, &boot_wg, stop_ch)
  }

  if config.Options.Traps_listen != "" {
    wg.Add(1)
    go trapserver(&wg, stop_ch)
  }

  if waitTimeout(&boot_wg, time.Duration(config.Options.Bootstrap_timeout)*time.Second) {
    logError("main: ", "Bootstrap timed out, continue without some aux info")
  } else {
    fmt.Println("main: bootstrap done")
  }

  wg.Add(1)
  go http_server(&wg, stop_ch)

  for ip, wlc := range config.Wlcs {
    if wlc.Enabled > 0 {
      wg.Add(1)
      go worker(ip, &wg, stop_ch)
    }
  }

  MAIN_LOOP: for {
    main_timer := time.NewTimer(10 * time.Second)

    //fmt.Println("main: sleeping 10 seconds")

    select {
    case s := <-sig_ch:
      if !main_timer.Stop() {
        <-main_timer.C
      }
      if s == syscall.SIGHUP || s == syscall.SIGUSR1 {
        continue MAIN_LOOP
      }
      break MAIN_LOOP
    case <-main_timer.C:
      //PrintMemUsage()
      continue MAIN_LOOP
    }

  }

  fmt.Println("main: stopping workers")

  close(stop_ch)

  if waitTimeout(&wg, 10 * time.Second) {
    fmt.Println("main: workers wait timeout!")
  }

  fmt.Println("main: Done")
}
