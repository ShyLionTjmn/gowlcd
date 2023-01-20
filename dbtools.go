package main

import(
  "database/sql"
  "reflect"
  _ "github.com/go-sql-driver/mysql"
  "github.com/davecgh/go-spew/spew"
  "fmt"
  "errors"
  "strconv"
  "encoding/hex"
)

func init() {
  _ = spew.Sdump(nil)
  _ = fmt.Sprint("")
}

func decode_var(ct *sql.ColumnType, val interface{}) (interface{}, error) {

  var ret interface{}

  switch val.(type) {
  case int64:
    ret = val.(int64)
  case []uint8:
    switch ct.ScanType() {
    case reflect.TypeOf(uint8(0)):
      c, cerr := strconv.ParseUint(string(val.([]uint8)), 10, 8)
      if cerr != nil { return nil, cerr }
      ret = uint8(c)
    case reflect.TypeOf(uint16(0)):
      c, cerr := strconv.ParseUint(string(val.([]uint8)), 10, 16)
      if cerr != nil { return nil, cerr }
      ret = uint16(c)
    case reflect.TypeOf(uint32(0)):
      c, cerr := strconv.ParseUint(string(val.([]uint8)), 10, 32)
      if cerr != nil { return nil, cerr }
      ret = uint32(c)
    case reflect.TypeOf(uint64(0)):
      c, cerr := strconv.ParseUint(string(val.([]uint8)), 10, 64)
      if cerr != nil { return nil, cerr }
      ret = uint64(c)
    case reflect.TypeOf(int8(0)):
      c, cerr := strconv.ParseInt(string(val.([]uint8)), 10, 8)
      if cerr != nil { return nil, cerr }
      ret = int8(c)
    case reflect.TypeOf(int16(0)):
      c, cerr := strconv.ParseInt(string(val.([]uint8)), 10, 16)
      if cerr != nil { return nil, cerr }
      ret = int16(c)
    case reflect.TypeOf(int32(0)):
      c, cerr := strconv.ParseInt(string(val.([]uint8)), 10, 32)
      if cerr != nil { return nil, cerr }
      ret = int32(c)
    case reflect.TypeOf(int64(0)):
      c, cerr := strconv.ParseInt(string(val.([]uint8)), 10, 64)
      if cerr != nil { return nil, cerr }
      ret = int64(c)
    case reflect.TypeOf(float32(0)):
      c, cerr := strconv.ParseFloat(string(val.([]uint8)), 32)
      if cerr != nil { return nil, cerr }
      ret = float32(c)
    case reflect.TypeOf(float64(0)):
      c, cerr := strconv.ParseFloat(string(val.([]uint8)), 64)
      if cerr != nil { return nil, cerr }
      ret = float64(c)
    case reflect.TypeOf(sql.NullInt64{}):
      c, cerr := strconv.ParseInt(string(val.([]uint8)), 10, 64)
      if cerr == nil {
        ret = c
      } else {
        uc, ucerr := strconv.ParseUint(string(val.([]uint8)), 10, 64)
        if ucerr != nil { return nil, ucerr }
        ret = uc
      }
    case reflect.TypeOf(sql.NullFloat64{}):
      c, cerr := strconv.ParseFloat(string(val.([]uint8)), 64)
      if cerr != nil { return nil, cerr }
      ret = float64(c)
    default:
      switch ct.DatabaseTypeName() {
      case "BIT":
        ret = "0x"+hex.EncodeToString(val.([]uint8))
      case "DECIMAL":
        c, cerr := strconv.ParseFloat(string(val.([]uint8)), 64)
        if cerr != nil { return nil, cerr }
        ret = float64(c)
      default:
        ret = string(val.([]uint8))
      }
    }
  case nil:
    if nullable, ok := ct.Nullable(); ok && !nullable {
      return nil, errors.New("NULL for not nullable field \""+ct.Name()+"\" returned")
    }
    ret =  nil
  default:
    return nil, errors.New("Bad type "+reflect.TypeOf(val).String()+" returned")
  }

  return ret, nil
}

func return_query(db interface{}, query string, index string, args ...interface{}) (interface{}, error) {
  var ret interface{}
  if index == "" {
    ret = make([]M, 0)
  } else {
    ret = make(M)
  }

  var rows *sql.Rows
  var err error

  switch db.(type) {
  case *sql.DB:
    rows, err = db.(*sql.DB).Query(query, args...)
  case *sql.Tx:
    rows, err = db.(*sql.Tx).Query(query, args...)
  default:
    return nil, errors.New("Bad db handle type:"+reflect.TypeOf(db).String())
  }

  if err != nil { return nil, err }

  defer rows.Close()

  var cols []string

  cols, err = rows.Columns()
  if err != nil { return nil, err }

  index_column := -1
  if index != "" {
    for i := range cols {
      if cols[i] == index {
        index_column = i
        break
      }
    }
    if index_column == -1 { return nil, errors.New("No index column with name "+index+" in result set") }
  }

  var cts []*sql.ColumnType

  cts, err = rows.ColumnTypes()
  if err != nil { return nil, err }
  _ = cts


  for rows.Next() {
    ptrs := make([]interface{}, len(cols))
    vals := make([]interface{}, len(cols))

    for i, _ := range ptrs {
      ptrs[i] = &vals[i]
    }

    err = rows.Scan(ptrs...)
    if err != nil { return nil, err }

    row := make(M)

    var index_value string

    for i, val := range vals {
      var v interface{}
      v, err = decode_var(cts[i], val)
      if err != nil { return nil, err }
      row[cols[i]] = v

      if i == index_column {
        index_value = fmt.Sprint(v)
      }
    }

    if index == "" {
      ret = append(ret.([]M), row)
    } else {
      ret.(M)[ index_value ] = row
    }
  }

  return ret, nil
}

func return_query_M(db interface{}, query string, index string, args ...interface{}) (M, error) {
  m, err := return_query(db, query, index, args...)
  if err != nil { return nil, err }
  var ret M
  var ok bool
  if ret, ok = m.(M); !ok { return nil, errors.New("return_query_M: Bad type returned by return_query") }
  return ret, nil
}

func return_query_A(db interface{}, query string, args ...interface{}) ([]M, error) {
  m, err := return_query(db, query, "", args...)
  if err != nil { return nil, err }
  var ret []M
  var ok bool
  if ret, ok = m.([]M); !ok { return nil, errors.New("return_query_A: Bad type returned by return_query") }
  return ret, nil
}

func db_exec(db interface{}, query string, args ...interface{}) (sql.Result, error) {
  switch db.(type) {
  case *sql.DB:
    return db.(*sql.DB).Exec(query, args...)
  case *sql.Tx:
    return db.(*sql.Tx).Exec(query, args...)
  default:
    return nil, errors.New("Bad db handle type:"+reflect.TypeOf(db).String())
  }
}

func return_arrays(db interface{}, query string, args ...interface{}) ([][]interface{}, error) {
  ret := make([][]interface{}, 0)

  var rows *sql.Rows
  var err error

  switch db.(type) {
  case *sql.DB:
    rows, err = db.(*sql.DB).Query(query, args...)
  case *sql.Tx:
    rows, err = db.(*sql.Tx).Query(query, args...)
  default:
    return nil, errors.New("Bad db handle type:"+reflect.TypeOf(db).String())
  }

  if err != nil { return nil, err }

  defer rows.Close()

  var cts []*sql.ColumnType

  cts, err = rows.ColumnTypes()
  if err != nil { return nil, err }

  for rows.Next() {
    ptrs := make([]interface{}, len(cts))
    vals := make([]interface{}, len(cts))

    for i, _ := range ptrs {
      ptrs[i] = &vals[i]
    }

    err = rows.Scan(ptrs...)
    if err != nil { return nil, err }

    row := make([]interface{}, len(cts))

    for i, val := range vals {
      var v interface{}
      v, err = decode_var(cts[i], val)
      if err != nil { return nil, err }
      row[i] = v
    }

    ret = append(ret, row)
  }

  return ret, nil
}

func must_return_one_M(db interface{}, query string, args ...interface{}) (M, error) {
  a, err := return_query_A(db, query, args...)
  if err != nil { return nil, err }

  if len(a) == 0 {
    return nil, errors.New("Zero rows returned")
  }
  if len(a) > 1 {
    return nil, errors.New("More than one rows returned")
  }

  return a[0], nil
}

func must_return_one_uint(db interface{}, query string, args ...interface{}) (uint64, error) {
  a, err := return_arrays(db, query, args...)
  if err != nil { return 0, err }

  if len(a) == 0 {
    return 0, errors.New("Zero rows returned")
  }
  if len(a) > 1 {
    return 0, errors.New("More than one rows returned")
  }

  if len(a[0]) != 1 {
    return 0, errors.New("More than one columns returned")
  }

  switch v := a[0][0].(type) {
  case int64:
    if v < 0 { return 0, errors.New("Negative value returned") }
    return uint64(v), nil
  case int32:
    if v < 0 { return 0, errors.New("Negative value returned") }
    return uint64(v), nil
  case int16:
    if v < 0 { return 0, errors.New("Negative value returned") }
    return uint64(v), nil
  case int8:
    if v < 0 { return 0, errors.New("Negative value returned") }
    return uint64(v), nil
  case int:
    if v < 0 { return 0, errors.New("Negative value returned") }
    return uint64(v), nil
  case uint64:
    return uint64(v), nil
  case uint32:
    return uint64(v), nil
  case uint16:
    return uint64(v), nil
  case uint8:
    return uint64(v), nil
  case uint:
    return uint64(v), nil
  default:
    return 0, errors.New("Non-numeric value returned: type: "+reflect.TypeOf(a[0][0]).Name())
  }
  panic("Should not get here")
}
