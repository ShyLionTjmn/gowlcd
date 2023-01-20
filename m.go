package main

import (
  "strconv"
  "math"
)

type M map[string]interface{}

func (m M) Has(k string) (bool) {
  _, ex := m[k]
  return ex
}

func (m M) Uint64(k string) (uint64, bool) {
  var v interface{}
  var ok bool
  if v, ok = m[k]; !ok { return 0, false }

  switch v.(type) {
  case uint64:
    return v.(uint64), true
  case uint32:
    return uint64(v.(uint32)), true
  case uint:
    return uint64(v.(uint)), true
  case uint16:
    return uint64(v.(uint16)), true
  case uint8:
    return uint64(v.(uint8)), true
  case int64:
    if v.(int64) < 0 { return 0, false }
    return uint64(v.(int64)), true
  case int:
    if v.(int) < 0 { return 0, false }
    return uint64(v.(int)), true
  case int32:
    if v.(int32) < 0 { return 0, false }
    return uint64(v.(int32)), true
  case int16:
    if v.(int16) < 0 { return 0, false }
    return uint64(v.(int16)), true
  case int8:
    if v.(int8) < 0 { return 0, false }
    return uint64(v.(int8)), true
  case string:
    ret, err := strconv.ParseUint(v.(string), 10, 64)
    if err != nil { return 0, false }
    return ret, true
  case float64:
    if v.(float64) < float64(0) { return 0, false }
    if math.Floor(v.(float64)) > math.MaxUint64 { return 0, false }
    return uint64(math.Floor(v.(float64))), true
  }
  return 0, false
}

func (m M) Int64(k string) (int64, bool) {
  var v interface{}
  var ok bool
  if v, ok = m[k]; !ok { return 0, false }

  switch v.(type) {
  case uint64:
    if v.(uint64) > 9223372036854775807 { return 0, false }
    return int64(v.(uint64)), true
  case uint32:
    return int64(v.(uint32)), true
  case uint:
    return int64(v.(uint)), true
  case uint16:
    return int64(v.(uint16)), true
  case uint8:
    return int64(v.(uint8)), true
  case int64:
    return v.(int64), true
  case int:
    return int64(v.(int)), true
  case int32:
    return int64(v.(int32)), true
  case int16:
    return int64(v.(int16)), true
  case int8:
    return int64(v.(int8)), true
  case string:
    ret, err := strconv.ParseInt(v.(string), 10, 64)
    if err != nil { return 0, false }
    return ret, true
  case float64:
    if v.(float64) < math.MinInt64 { return 0, false }
    if math.Floor(v.(float64)) > math.MaxInt64 { return 0, false }
    return int64(math.Floor(v.(float64))), true
  }
  return 0, false
}

func (m M) UintString(k string) (string, bool) {
  var v uint64
  var ok bool
  v, ok = m.Uint64(k)
  if !ok { return "", false }
  return strconv.FormatUint(v, 10), true
}

func (m M) IntString(k string) (string, bool) {
  var v int64
  var ok bool
  v, ok = m.Int64(k)
  if !ok { return "", false }
  return strconv.FormatInt(v, 10), true
}

func (m M) String(k string) (string, bool) {
  var v string
  var ok bool
  if _, ok = m[k]; !ok { return "", false }
  v, ok = m[k].(string)
  if !ok { return "", false }
  return v, true
}

func (m M) AnyString(k string) (string, bool) {
  var v interface{}
  var ok bool
  if v, ok = m[k]; !ok { return "", false }

  switch v.(type) {
  case uint64:
    return strconv.FormatUint(v.(uint64), 10), true
  case uint32:
    return strconv.FormatUint(uint64(v.(uint32)), 10), true
  case uint:
    return strconv.FormatUint(uint64(v.(uint)), 10), true
  case uint16:
    return strconv.FormatUint(uint64(v.(uint16)), 10), true
  case uint8:
    return strconv.FormatUint(uint64(v.(uint8)), 10), true
  case int64:
    return strconv.FormatInt(v.(int64), 10), true
  case int:
    return strconv.FormatInt(int64(v.(int)), 10), true
  case int32:
    return strconv.FormatInt(int64(v.(int32)), 10), true
  case int16:
    return strconv.FormatInt(int64(v.(int16)), 10), true
  case int8:
    return strconv.FormatInt(int64(v.(int8)), 10), true
  case string:
    return v.(string), true
  }
  return "", false
}
