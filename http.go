package main

import (
  //"fmt"
  "io"
  "reflect"
  "sync"
  "math"
  "strings"
  "context"
  "time"
  "encoding/json"
  "net"
  "net/http"
  "regexp"
  "errors"
  "golang.org/x/net/netutil"
  "github.com/gomodule/redigo/redis"
  "github.com/qdm12/reprint"
  //wai "github.com/jimlawless/whereami"
  "runtime/debug"
  rrd "github.com/multiplay/go-rrd"
  //"github.com/davecgh/go-spew/spew"
)

type gDS struct {
  Label string `json:"label"`
  Data []interface{} `json:"data"`
}

func http_server(wg *sync.WaitGroup, stop_ch chan struct{}) {

  //fmt.Println(whereami.WhereAmI())

  defer wg.Done()

  s := &http.Server{
    Addr:       config.Options.Http_server_addr,
  }

  server_shut := make(chan struct{})

  go func() {
    select {
    case <-stop_ch:
    }
//    if opt_v > 0 {
//      fmt.Println("Shutting down HTTP server")
//    }
    ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(500 * time.Millisecond))
    defer cancel()

    shut_err := s.Shutdown(ctx)
    if shut_err != nil {
//      if opt_v > 0 {
//        color.Red("HTTP server Shutdown error: %v\n", shut_err)
//      }
    }
    close(server_shut)
  }()

  http.HandleFunc("/", handleRoot)

  listener, listen_err := net.Listen("tcp", config.Options.Http_server_addr)
  if listen_err != nil {
    panic("Listening error: "+listen_err.Error())
  }

  defer listener.Close()
  listener = netutil.LimitListener(listener, config.Options.Http_max_conn)

  http_err := s.Serve(listener)
  if http_err != http.ErrServerClosed {
//    if opt_v > 0 {
//      color.Red("HTTP server shot down with error: %s", http_err)
//    }
  }
  select {
  case <-server_shut:
  }
}

type E struct {
  code int
  message string
}

func error_exit(code int, message string) {
  panic(&E{code, message})
}

func get_p_string(q map[string]interface{}, name string, check interface{}, options ... interface{}) (string,error) { // options: (error on empty(true by default)), (dafault value) 
  val, exists := q[name]
  if !exists {
    if len(options) == 0 || options[0].(bool) {
      return "", errors.New("Missing parameter: "+name)
    }
    if len(options) > 1 {
      return options[1].(string), nil
    } else {
      return "", nil
    }
  }

  if reflect.TypeOf(val).String() != "string" {
    return "", errors.New("Bad parameter type: "+name)
  }

  _val := val.(string)

  switch c := check.(type) {
  case nil:
    return _val, nil
  case string:
    reg, err := regexp.Compile(c)
    if err != nil {
      return "", err
    }
    if !reg.MatchString(_val) {
      return "",errors.New("Bad parameter value: "+name+": "+_val)
    }
  case *regexp.Regexp:
    if !c.MatchString(_val) {
      return "", errors.New("Bad parameter value: "+name+": "+_val)
    }
  case []string:
    found := false
    for _, v := range c {
      if _val == v {
        found = true
        break
      }
    }
    if !found {
      return "", errors.New("Bad parameter value: "+name+": "+_val)
    }
  default:
    return "", errors.New("Unknown param type")
  }

  return _val, nil
}

func get_p_array(q map[string]interface{}, name string, check interface{}, options ... interface{}) ([]string,error) { // options: (error on empty(true by default)), (dafault value) 
  val, exists := q[name]
  if !exists {
    if len(options) == 0 || options[0].(bool) {
      return nil, errors.New("Missing parameter: "+name)
    }
    if len(options) > 1 {
      return options[1].([]string), nil
    } else {
      return make([]string,0), nil
    }
  }

  if reflect.TypeOf(val).String() != "[]interface {}" {
    return nil, errors.New("Bad parameter type: "+name+": "+reflect.TypeOf(val).String())
  }

  for _, vv := range val.([]interface{}) {
    if reflect.TypeOf(vv).String() != "string" {
      return nil, errors.New("Bad parameter type: "+name+": "+reflect.TypeOf(vv).String())
    }
  }

  _val := make([]string, len(val.([]interface{})))
  for i, vv := range val.([]interface{}) {
    _val[i] = vv.(string)
  }

  switch c := check.(type) {
  case nil:
    return _val, nil
  case string:
    reg, err := regexp.Compile(c)
    if err != nil {
      return nil, err
    }
    for _, vv := range _val {
      if !reg.MatchString(vv) {
        return nil, errors.New("Bad parameter value: "+name+": "+vv)
      }
    }
  case *regexp.Regexp:
    for _, vv := range _val {
      if !c.MatchString(vv) {
        return nil, errors.New("Bad parameter value: "+name+": "+vv)
      }
    }
  case []string:
    for _, vv := range _val {
      found := false
      for _, v := range c {
        if vv == v {
          found = true
          break
        }
      }
      if !found {
        return nil, errors.New("Bad parameter value: "+name+": "+vv)
      }
    }
  default:
    return nil, errors.New("Unknown param type")
  }

  return _val, nil
}

func require_param(req *http.Request, name string, check interface{}, options ... interface{}) string {
  _, exists := req.Form[name]
  if !exists {
    if len(options) == 0 || options[0].(bool) {
      panic(&E{http.StatusBadRequest, "Missing parameter: "+name})
    }
    if len(options) > 1 {
      return options[1].(string)
    } else {
      return ""
    }
  }

  val := req.FormValue(name)

  switch c := check.(type) {
  case nil:
    return val
  case string:
    reg, err := regexp.Compile(c)
    if err != nil {
      panic(err)
    }
    if !reg.MatchString(val) {
      panic(&E{http.StatusBadRequest, "Bad parameter value: "+name+": "+val})
    }
  case *regexp.Regexp:
    if !c.MatchString(val) {
      panic(&E{http.StatusBadRequest, "Bad parameter value: "+name+": "+val})
    }
  case []string:
    found := false
    for _, v := range c {
      if val == v {
        found = true
        break
      }
    }
    if !found {
      panic(&E{http.StatusBadRequest, "Bad parameter value: "+name+": "+val})
    }
  default:
    panic("Unknown param type")
  }

  return val
}

func handle_error(r interface{}, w http.ResponseWriter, req *http.Request) {
  if r == nil {
    return
  }
  code := http.StatusInternalServerError
  var first_line string
  var message string

  switch v := r.(type) {
  case string:
    message = v
  case E:
    code = v.code
    message = v.message
  case *E:
    code = v.code
    message = v.message
  case error:
    message = v.Error()
  default:
    message = "Unknown error"
  }

  if code == http.StatusInternalServerError {
    for _, s := range strings.Split(string(debug.Stack()), "\n") {
      w.Header().Add("X-Stack", s)
    }
  }

  for i, s := range strings.Split(message, "\n") {
    w.Header().Add("X-Error", s)
    if i == 0 {
      first_line = s
    }
  }
  w.Header().Set("Access-Control-Allow-Origin", "*")
  w.Header().Set("Access-Control-Allow-Methods", "*")
  w.Header().Set("Access-Control-Allow-Headers", "*")
  http.Error(w, first_line, code)
}

func handleRoot(w http.ResponseWriter, req *http.Request) {

  if req.Method == "OPTIONS" {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "*")
    w.Header().Set("Access-Control-Allow-Headers", "*")
    w.WriteHeader(http.StatusOK)
    return
  }

  //fmt.Println(whereami.WhereAmI())

  defer func() { handle_error(recover(), w, req); } ()

  mutex_locked := false
  defer func() { if mutex_locked { globalMutex.Unlock(); mutex_locked = false; }; } ()

  var body []byte
  var err error

  if body, err = io.ReadAll(req.Body); err != nil {
    panic(err)
  }

  var q map[string]interface{}

  if err = json.Unmarshal(body, &q); err != nil {
    panic(err)
  }

  if _, action_ex := q["action"]; !action_ex {
    panic("no action in query")
  }

  if reflect.TypeOf(q["action"]).String() != "string" {
    panic("wrong action type")
  }

  action := q["action"].(string)

  out := make(map[string]interface{})

  var red redis.Conn

  if action == "get_scan_data" {
    globalMutex.RLock()
    mutex_locked = true


    var aps map[string]*apInfo

    if rperr := reprint.FromTo(&globalAps, &aps); rperr != nil {
      panic(rperr)
    }
    //var j []byte
    //var err error


    out["wlcs"]=globalWlcs
    out["aps"]=aps
    out["clients"]=globalClients

    dl := make([]string, 0)

    //fmt.Println(whereami.WhereAmI())

    red, err = redis.Dial(config.Options.Redis_conn_type, config.Options.Redis_conn_address, redis.DialDatabase(config.Options.Redis_db))
    if err != nil {
      panic("Redis dial error: "+err.Error())
    }
    defer red.Close()

    var ap_wlc_keys []string
    ap_wlc_keys, err = redis.Strings(red.Do("KEYS", "ap_wlc_*"))
    if err == nil {
      for _, ap_wlc_key := range ap_wlc_keys {
  //dl = append(dl, "checking "+ap_wlc_key)
        var ap_wlc string
        ap_wlc, err = redis.String(red.Do("GET", ap_wlc_key))
        if err != nil {
          panic("Redis error: "+err.Error())
        }
  //dl = append(dl, "got "+ap_wlc_key+" wlc: "+ap_wlc)
        ap_mac := ap_wlc_key[7:]
        ap_global_key := ap_mac+"@"+ap_wlc

        if _, ok := globalAps[ap_global_key]; !ok {
  //dl = append(dl, "getting json for "+ap_global_key)
          var ap_json string
          ap_json, err = redis.String(red.Do("GET", "ap_data_"+ap_mac))
          if err == nil {
            var apData apInfo
            err = json.Unmarshal([]byte(ap_json), &apData)
            if err == nil {
              apData.Status = "offline"
              aps[ apData.Mac+"@"+apData.Wlc ] = &apData
            }
          }
        }
      }
    }

    out["_debug"] = dl
  } else if action == "graph" {
    //spew.Dump(q)
    var obj string
    if obj, err = get_p_string(q, "object", `^(?:wlc|ap|client)$`); err != nil {
      panic(err)
    }

    var id string
    if id, err = get_p_string(q, "id", `^(?:[0-9a-f]{12}@)?\d+\.\d+\.\d+\.\d+$`); err != nil {
      panic(err)
    }

    var start string
    if start, err = get_p_string(q, "start", uint_reg); err != nil {
      panic(err)
    }

    var end string
    if end, err = get_p_string(q, "end", uint_reg); err != nil {
      panic(err)
    }

    var keys []string
    if keys, err = get_p_array(q, "keys", `^[a-zA-Z0-9_]+$`); err != nil {
      panic(err)
    }

    var rrd_file = config.Options.RRD_base_dir

    switch obj {
    case "wlc":
      rrd_file += "wlcs/"+id+".rrd"
    case "ap":
      rrd_file += "aps/"+id+".rrd"
    case "client":
      rrd_file += "clients/"+id+".rrd"
    default:
      panic("Unknown obj")
    }

    rrdc, rrdc_err := rrd.NewClient(config.Options.RRD_socket, rrd.Unix)
    if rrdc_err != nil {
      panic("RRD connect error: "+rrdc_err.Error())
    }
    defer rrdc.Close()

    args_list := make([]interface{}, 0)
    args_list = append(args_list, start, end)
    for _, key := range keys {
      args_list = append(args_list, key)
    }

    var res *rrd.FetchBin

    if res, err = rrdc.FetchBin(rrd_file, "AVERAGE", args_list...); err != nil {
      panic("RRD fetch error: "+err.Error())
    }

    //spew.Dump(res)

    g_labels := make([]int64, 0)
    intStep := int64(res.FetchCommon.Step.Seconds())

    for t := res.FetchCommon.Start.Unix(); t < res.FetchCommon.End.Unix(); t += intStep {
      g_labels = append(g_labels, t*1000)
    }

    //fmt.Println("len:", len(g_labels))

    g_datasets := make([]gDS, len(keys))

    for ds_i, ds := range res.DS {
      g_datasets[ds_i].Label = ds.Name
      g_datasets[ds_i].Data = make([]interface{}, len(g_labels))
      for data_i, data_val := range ds.Data {
        if math.IsNaN(data_val.(float64)) {
          g_datasets[ds_i].Data[data_i] = nil
        } else {
          g_datasets[ds_i].Data[data_i] = data_val
        }
      }
    }

    out["labels"] = g_labels
    out["datasets"] = g_datasets

    out["_start"] = res.FetchCommon.Start.Unix()
    out["_end"] = res.FetchCommon.End.Unix()

  } else if action == "get_mac_events" || action == "get_user_events" {
    var macOrUser string
    var red_key string
    if action == "get_mac_events" {
      if macOrUser, err = get_p_string(q, "mac", mac_reg); err != nil {
        panic(err)
      }
      red_key = "events_mac_"+macOrUser
    } else if action == "get_user_events" {
      if macOrUser, err = get_p_string(q, "user", user_reg); err != nil {
        panic(err)
      }
      red_key = "events_user_"+macOrUser
    }

    red, err = redis.Dial(config.Options.Redis_conn_type, config.Options.Redis_conn_address, redis.DialDatabase(config.Options.Redis_db))
    if err != nil {
      panic("Redis dial error: "+err.Error())
    }
    defer red.Close()

    var journal []string
    journal, err = redis.Strings(red.Do("LRANGE", red_key, 0, -1))

    if err != nil {
      if err != redis.ErrNil {
        panic(err)
      }
      journal = make([]string, 0)
    }

    events_list := make([]interface{}, 0)

    for _, j_str := range journal {
      parts := strings.SplitN(j_str, "\t", 3)

      if(len(parts) != 3) {
        continue
      }

      event := make(map[string]interface{})
      event["time"] = parts[0]
      event["event_type"] = parts[1]

      event_data := make(map[string]interface{})
      jerr := json.Unmarshal([]byte(parts[2]), &event_data)
      if jerr != nil {
        event_data["_error"] = jerr.Error()
      }

      event["event"] = event_data
      events_list = append(events_list, event)
    }

    out["events"] = events_list

    globalMutex.RLock()
    mutex_locked = true

    if action == "get_mac_events" {
      mac_info := make([]macInfo, 0)
      if mi, mi_ex := globalMacInfo[macOrUser]; mi_ex {
        reprint.FromTo(&mi, &mac_info)
      }
      out["mac_info"] = mac_info
    }

    globalMutex.RUnlock()
    mutex_locked = false


  } else {
    panic("Unknown action '"+action+"'")
  }

  ok_out := make(map[string]interface{})
  ok_out["ok"] = out
  json, jerr := json.MarshalIndent(ok_out, "", "  ")
  if jerr != nil {
    panic(jerr)
  }

  if mutex_locked {
    globalMutex.RUnlock()
    mutex_locked = false
  }

  w.Header().Set("Content-Type", "text/javascript; charset=UTF-8")
  w.Header().Set("Cache-Control", "no-cache")
  w.Header().Set("Access-Control-Allow-Origin", "*")
  w.Header().Set("Access-Control-Allow-Methods", "*")
  w.Header().Set("Access-Control-Allow-Headers", "*")
  w.WriteHeader(http.StatusOK)

  w.Write(json)
  w.Write([]byte("\n"))
}
/*
func handleGraph(w http.ResponseWriter, req *http.Request) {

  defer func() { handle_error(recover(), w, req); } ()

  req.ParseForm()

  mutex_locked := false
  defer func() { if mutex_locked { globalMutex.Unlock(); mutex_locked = false; }; } ()

  var red redis.Conn
  var err error

  red, err = redis.Dial(config.Options.Redis_conn_type, config.Options.Redis_conn_address, redis.DialDatabase(config.Options.Redis_db))
  if err != nil {
    panic("Redis dial error: "+err.Error())
  }
  defer red.Close()

  red_key := "graph_cache_"

  subj_type := require_param(req, "type", []string{"ap_users"})

  red_key += subj_type+"_"

  var mac string
  var wlc string
  var ap_radio string

  var rrd_file = config.Options.RRD_base_dir
  fields_list := make([]interface{}, 0)

  var start = fmt.Sprintf("%d", time.Now().Add(-time.Hour).Unix())
  var end = fmt.Sprintf("%d", time.Now().Unix())

  start = require_param(req, "start", uint_reg, false, start)
  end = require_param(req, "end", uint_reg, false, end)

  switch subj_type {
  case "ap_users":
    mac = require_param(req, "mac", mac_reg)
    wlc = require_param(req, "wlc", ip_reg)
    ap_radio = require_param(req, "radios", []string{"0", "1", "0,1"})
    rrd_file += "aps/"+mac+"@"+wlc
    for _, r := range strings.Split(ap_radio, ",") {
      fields_list = append(fields_list, "r_users_"+r)
    }
  default:
    panic("Code error at: "+wai.WhereAmI())
  }

  rrd_file += ".rrd"

  red_key += mac+"_"+wlc+"_"+ap_radio+"_"+start+"_"+end

  _, no_cache := req.Form["no_cache"]
  if !no_cache {
    _, no_cache = req.Form["no-cache"]
  }
  if !no_cache {
    _, no_cache = req.Form["nocache"]
  }

  if !no_cache {
    bytes, err := redis.Bytes(red.Do("GET", red_key))
    if err == nil {
      //stream bytes to client

        //w.Header().Set("Content-Type", "image/png")
        w.Header().Set("Cache-Control", "no-cache")
        w.WriteHeader(http.StatusOK)
        w.Write(bytes)

        return
    } else if(err != redis.ErrNil) {
      panic(err)
    }
  }

  rrdc, rrdc_err := rrd.NewClient(config.Options.RRD_socket, rrd.Unix)
  if rrdc_err != nil {
    panic("RRD connect error: "+rrdc_err.Error())
  }
  defer rrdc.Close()

  args_list := make([]interface{}, 0)
  args_list = append(args_list, start, end)
  args_list = append(args_list, fields_list...)

  if res, err := rrdc.FetchBin(rrd_file, "AVERAGE", args_list...); err != nil {
    panic("RRD fetch error: "+err.Error())
  } else {

    w.Header().Set("Content-Type", "application/json; charset=UTF-8")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "*")
    w.Header().Set("Access-Control-Allow-Headers", "*")
    w.WriteHeader(http.StatusOK)

  }
}
*/
