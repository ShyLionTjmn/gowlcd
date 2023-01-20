package main

import (
  "sync"
)

var globalMutex = &sync.RWMutex{}

type macInfo struct {
  Username string `json:"usrn"`
  Displayname string `json:"dspn"`
  Reason string `json:"reas"`
}
var globalMacInfo = make(map[string][]macInfo)

type siteInfo struct {
  Mask uint8 `json:"mask"`
  Site string `json:"site"`
  Tags string `json:"tags"`
  Netname string `json:"netname"`
  First uint32 `json:"first"`
  Last uint32 `json:"last"`
}
var globalSites = make(map[uint32]*siteInfo)

type wlcInfo struct {
  Status string `json:"status"`
  Site string `json:"site"`
  SiteTags string `json:"site_tags"`
  Netname string `json:"netname"`
  Error string `json:"error"`
  Last_ok int64 `json:"last_ok"`
  Last_seen int64 `json:"last_seen"`
  Ssids map[string]string `json:"ssids"`
  RRD_file bool `json:"rrd_file"`
  Stats map[string]int64 `json:"stats"`
  Attrs map[string]string `json:"attrs"`
}
var globalWlcs = make(map[string]*wlcInfo)

type apInfo struct {
  Status string `json:"status"`
  Wlc string `json:"ap_wlc"`
  Mac string `json:"ap_mac"`
  Attrs map[string]string `json:"ap_attrs"`
  RadioAttrs map[string]map[string]string `json:"ap_radio_attrs"`
  CdpNeiAttrs map[string]map[string]string `json:"ap_cdp_neighbours"`
  Last_ok int64 `json:"last_ok"`
  RRD_file bool `json:"rrd_file"`
  added int64
  keys_check int
}

var globalAps = make(map[string]*apInfo)

type clientInfo struct {
  Wlc string `json:"client_wlc"`
  Mac string `json:"client_mac"`
  Attrs map[string]string `json:"client_attrs"`
  RRD_file bool `json:"rrd_file"`
  Mac_info []macInfo `json:"client_mac_info"`
  added int64
  check int64
  keys_check int
  rrd_created bool
}

var globalClients = make(map[string]*clientInfo)

type clientMoveInfo struct {
  Client *clientInfo `json:"client"`
  PrevAP_MAC string  `jsov:"prev_ap_mac"`
  PrevAP_Radio string  `jsov:"prev_ap_radio"`
}

var globalOui = make(map[string]string)

var globalUnknownOIDs = make(map[string]struct{})
