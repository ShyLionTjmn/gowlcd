'use strict';

var body;
var user_self_id="none";

var global_mouse_down=false;

var global_AP_models={};

function save_local(key, value) {
  localStorage.setItem(key+"_"+user_self_id, JSON.stringify(value));
};

function del_local(key) {
  if(typeof(key) === 'string') {
    localStorage.removeItem(key+"_"+user_self_id);
  } else if(key instanceof RegExp) {
    let keys=[];
    for(let i=0; i < localStorage.length; i++) {
      if(localStorage.key(i).match(key)) {
        keys.push(localStorage.key(i));
      };
    };
    for(let i in keys) {
      localStorage.removeItem(keys[i]);
    };
  };
};

function get_local(key, on_error=undefined) {
  let js=localStorage.getItem(key+"_"+user_self_id);
  if(js == undefined || js == "null") return on_error;
  try {
    return JSON.parse(localStorage.getItem(key+"_"+user_self_id));
  } catch(e) {
    return on_error;
  };
};

function num_compare(a, b) {
  let aa=a.split(/(\d+)/);
  let ba=b.split(/(\d+)/);

  while(aa.length > 0 && ba.length > 0) {
    let av=aa.shift();
    let bv=ba.shift();
    if(isNaN(av) && !isNaN(bv)) {
      return 1;
    } else if(isNaN(bv) && !isNaN(av)) {
      return -1;
    } else if(isNaN(av) && isNaN(bv)) {
      let cres=av.localeCompare(bv);
      if(cres != 0) return cres;
    } else {
      if(Number(av) > Number(bv)) {
        return 1;
      } else if(Number(av) < Number(bv)) {
        return -1;
      };
    };
  };

  if(aa.length == ba.length) {
    return 0;
  } else if(aa.length > ba.length) {
    return 1;
  } else {
    return -1;
  };
};

function pretty_MAC(mac, delim) {
  let m=mac.toLowerCase().match(/^([0-9a-f]{2})[:\.-]?([0-9a-f]{2})[:\.-]?([0-9a-f]{2})[:\.-]?([0-9a-f]{2})[:\.-]?([0-9a-f]{2})[:\.-]?([0-9a-f]{2})$/);
  if(m) {
    if(delim == ":") {
      return m[1]+":"+m[2]+":"+m[3]+":"+m[4]+":"+m[5]+":"+m[6];
    } else if(delim == ".") {
      return m[1]+m[2]+"."+m[3]+m[4]+"."+m[5]+m[6];
    } else if(delim == "-") {
      return m[1]+"-"+m[2]+"-"+m[3]+"-"+m[4]+"-"+m[5]+"-"+m[6];
    } else if(delim == "") {
      return m[1]+m[2]+m[3]+m[4]+m[5]+m[6];
    }
  };
  return mac;
};

function wdhm(time) {
  time=Math.floor(time);
  let w=Math.floor(time / (7*24*60*60));
  time = time - w*(7*24*60*60);

  let d=Math.floor(time / (24*60*60));
  time = time - d*(24*60*60);

  let h=Math.floor(time / (60*60));
  time = time - h*(60*60);

  let m=Math.floor(time / 60);
  let s=time - m*60;

  let ret="";
  if(w > 0) {
    ret = String(w)+" н. ";
  };
  if(d > 0 || w > 0) {
    ret += String(d)+" д. ";
  };
  if(h > 0 || d > 0 || w > 0) {
    ret += String(h)+" ч. ";
  };
  if(m > 0 || h > 0 || d > 0 || w > 0) {
    ret += String(m)+" м. ";
  };

  ret += String(s)+" с.";

  return ret;
};

var autoupdate_counter;
var autoupdate_timer;

function autoupdateFunc() {
  if(global_mouse_down) return;
  autoupdate_counter += 1;
  let interval=Number($("#autoupdate_interval").val());
  $(".autoupdate_indicator").text(interval - autoupdate_counter).show();
  if(autoupdate_counter >= interval) {
    autoupdate_counter=0;
    if(typeof(autoupdate_timer) !== 'undefined') {
      clearInterval(autoupdate_timer);
      autoupdate_timer = undefined;
    };

    $("#refresh_page").trigger("click");
  };
    
};

$( document ).ready(function() {

  window.onerror=function(errorMsg, url, lineNumber) {
    alert("Error occured: " + errorMsg + ", at line: " + lineNumber);//or any message
    return false;
  };

  $(document)
   .on("mousedown mouseup mousemove", function(e) {
     global_mouse_down = e.originalEvent.buttons === undefined ? e.which === 1 : e.buttons === 1;
   })
  ;

  $("BODY").append (
    $(DIV).css({"position": "fixed", "right": "0.5em", "top": "0.5em", "min-width": "2em",
                "border": "1px solid black", "background-color": "lightgrey"
    }).prop("id", "indicator").text("Запуск интерфейса...")
  );

  if(version.match(/devel/)) {
    $("BODY")
     //.append ( $(DIV).css({"position": "fixed", "right": "1em", "top": "1em", "color": "red" }).text("DEVELOPMENT"))
     //.append ( $(DIV).css({"position": "fixed", "left": "1em", "top": "1em", "color": "red" }).text("DEVELOPMENT"))
     .append ( $(DIV).css({"position": "fixed", "right": "1em", "bottom": "1em", "color": "red" }).text("DEVELOPMENT"))
     .append ( $(DIV).css({"position": "fixed", "left": "1em", "bottom": "1em", "color": "red" }).text("DEVELOPMENT"))
    ;
  };

  $(document).ajaxComplete(function() {
    $("#indicator").text("Запрос завершен").css("background-color", "lightgreen");
  });

  $(document).ajaxStart(function() {
    $("#indicator").text("Запрос ...").css("background-color", "yellow");
  });

  $( document ).tooltip({ items: ".tooltip[title]", show: null });
  body=$( "body" );
  body.css({"height": "100%", "margin": "0"});
  $("HTML").css({"height": "100%", "margin": "0"});

  if(version.match(/devel/)) {
    body
     .append( $(DIV).prop("id", "debug_win")
       .addClass("wsp")
       .css({"position": "fixed", "bottom": "1em", "right": "1em", "width": "35em", "top": "15em", "overflow": "auto", "border": "1px black solid"})
     )
    ;
  };

  $(DIV) //wrapper
   .css({"display": "flex", "height": "100%", "flex-direction": "column"})
   .append( $(DIV) //header
     .append( $(DIV)
       .css({"display": "inline-block", "margin-bottom": "1em"})
       .append( $(LABEL).addClass("button").text("Обновить")
         .prop("id", "refresh_page")
         .click(refresh_page)
       )
       .append( $(LABEL).prop({"for": "autoupdate"}).text("Автообновление: ").css({"margin-left": "1em"}) )
       .append( $(INPUT).prop({"id": "autoupdate", "type": "checkbox", "checked": get_local("autoupdate", false)} )
         .on("change", function() {
           let state=$(this).is(":checked");
           save_local("autoupdate", state);

           if(typeof(autoupdate_timer) !== 'undefined') {
             clearInterval(autoupdate_timer);
             autoupdate_timer = undefined;
           };

           let interval=Number($("#autoupdate_interval").val());

           if(state) {
             autoupdate_counter=0;
             $(".autoupdate_indicator").text(interval - autoupdate_counter).show();
             autoupdate_timer = setInterval(autoupdateFunc, 1000);
           } else {
             $(".autoupdate_indicator").hide();
           };
         })
       )
       .append( $(LABEL)
         .addClass("autoupdate_indicator")
         .css({"display": "inline-block", "width": "1.5em", "text-align": "center",
               "border": "1px black solid", "background-color": "#E0E0E0", "margin-left": "0.5em"
         })
         .hide()
       )
       .append( $(SELECT)
         .css({"margin-left": "0.5em"})
         .prop("id", "autoupdate_interval")
         .append( $(OPTION).val("60").text("1 мин") )
         .append( $(OPTION).val("30").text("30 сек") )
         .append( $(OPTION).val("5").text("5 сек") )
         .val( get_local("autoupdate_interval", "60") )
         .on("select change", function() { $("#autoupdate").trigger("change"); })
       )
       .append( $(LABEL).addClass("min1em") )
       .append( $(LABEL).addClass("button").text("Модели")
         .click(function() {
           show_dialog(jstr(global_AP_models));
         })
       )
       .append( $(SPAN).prop("id", "wlcs_list")
       )
       .append( $(FIELDSET)
         .append( $(LEGEND).text("Фильтр:") )
         .append( $(LABEL).prop("for", "ssid_filter").text("SSID ").title("Поиск по имени, точное совпадение!. Несколько фильтров можно разделить символом \"|\"")
           .append( $(LABEL).addClass("search_help").text("?") )
         )
         .append( $(LABEL).prop("for", "ssid_filter").text(" : ") )
         .append( $(INPUT).prop("id", "ssid_filter").val(get_local("ssid_filter", ""))
           .prop("type", "search")
           .data("filter_name", "ssid_filter")
           .enterKey(function() {
             save_local($(this).data("filter_name"), $(this).val())
             $("#apply_filter").trigger("click");
           })
           .on("change", function() {
             save_local($(this).data("filter_name"), $(this).val())
           })
           .inputStop(500)
           .on("input_stop", function() {
             save_local($(this).data("filter_name"), $(this).val())
             $("#apply_filter").trigger("click");
           })
         )
         .append( $(LABEL).css({"margin-left": "1em"}) )
         .append( $(LABEL).prop("for", "ap_filter").text("Точки доступа ")
           .title("Несколько фильтров можно разделить символом \"|\"\n"
             +"Поля для поиска:\n"
             +" Имя точки (как настроено на контроллере)\n"
             +" IP\n"
             +" MAC\n"
             +" Локация (как настроено на контроллере)\n"
             +" Сайт (по данным IPDB)\n"
             +" Модель\n"
             +" Серийный номер\n"
             +" Статус (online|offline|unknown)\n"
           )
           .append( $(LABEL).addClass("search_help").text("?") )
         )
         .append( $(LABEL).prop("for", "ap_filter").text(" : ") )
         .append( $(INPUT).prop("id", "ap_filter").val(get_local("ap_filter", ""))
           .prop("type", "search")
           .data("filter_name", "ap_filter")
           .enterKey(function() {
             save_local($(this).data("filter_name"), $(this).val())
             $("#apply_filter").trigger("click");
           })
           .on("change", function() {
             save_local($(this).data("filter_name"), $(this).val())
           })
           .inputStop(500)
           .on("input_stop", function() {
             save_local($(this).data("filter_name"), $(this).val())
             $("#apply_filter").trigger("click");
           })
         )
         .append( $(LABEL).css({"margin-left": "1em"}) )
         .append( $(LABEL).prop("for", "user_filter").text("Пользователи ")
           .title("Несколько фильтров можно разделить символом \"|\"\n"
             +"Поля для поиска:\n"
             +" Имя\n"
             +" Логин\n"
             +" Причина предоставления доступа\n"
             +" IP\n"
             +" MAC\n"
             +" Сайт, на котором терминируется сессия (по данным IPDB), может отличаться от реального местонахождения пользователя!\n"
             +" Производитель устройства (по данным MAC адреса)\n"
           )
           .append( $(LABEL).addClass("search_help").text("?") )
         )
         .append( $(LABEL).prop("for", "user_filter").text(" : ") )
         .append( $(INPUT).prop("id", "user_filter").val(get_local("user_filter", ""))
           .prop("type", "search")
           .data("filter_name", "user_filter")
           .enterKey(function() {
             save_local($(this).data("filter_name"), $(this).val())
             $("#apply_filter").trigger("click");
           })
           .on("change", function() {
             save_local($(this).data("filter_name"), $(this).val())
           })
           .inputStop(500)
           .on("input_stop", function() {
             save_local($(this).data("filter_name"), $(this).val())
             $("#apply_filter").trigger("click");
           })
         )
         .append( $(LABEL).css({"margin-left": "1em"}) )
         .append( $(LABEL).addClass("button").prop("id", "apply_filter").text("Применить")
           .click(function() {
             apply_filters( $("#workarea").find(".page") );
           })
         )
         .append( $(LABEL).css({"margin-left": "1em"}) )
         .append( $(LABEL).addClass("button").prop("id", "apply_filter").text("Очистить")
           .click(function() {
             $(this).closest("FIELDSET").find("INPUT").val("").trigger("change");
             apply_filters( $("#workarea").find(".page") );
           })
         )
       )
     )
   )
   .append( $(DIV).prop("id", "workarea")
     .css({"flex": "1", "overflow": "auto"})
   )
   .appendTo(body)
  ;

  $("#refresh_page").trigger("click");
  $("#user_filter").focus();
});

var data={};
var structure={};
var apsByMac={};

function get_ap_div(ap_id) {

  let wlc_ip=data["aps"][ap_id]["ap_wlc"];

  let ap_search_array=[];
  ap_search_array.push(data["aps"][ap_id]["ap_attrs"]["ap_name"].toLowerCase());
  ap_search_array.push(data["aps"][ap_id]["ap_attrs"]["ap_mac"].toLowerCase());
  ap_search_array.push(data["aps"][ap_id]["status"].toLowerCase());
  ap_search_array.push(data["aps"][ap_id]["ap_attrs"]["ap_model"].toLowerCase());
  ap_search_array.push(data["aps"][ap_id]["ap_attrs"]["ap_location"].toLowerCase());
  ap_search_array.push(data["aps"][ap_id]["ap_attrs"]["ap_serial"].toLowerCase());
  ap_search_array.push(data["aps"][ap_id]["ap_attrs"]["ap_site"].toLowerCase());
  ap_search_array.push(data["aps"][ap_id]["ap_attrs"]["ap_ip"].toLowerCase());

  let ap_div=$(DIV).addClass("ap_div")
   .data("id", ap_id)
  ;

  let ap_head=$(DIV).addClass("ap_head_div")
   .addClass("info_container")
   //.append( $(LABEL).addClass("ui-icon").addClass("ui-icon-caret-2-s").addClass("button")
   .append( $(LABEL).addClass("ui-icon").addClass("ui-icon-info").addClass("button").addClass("info_button")
     .title("Show info. Ctrl-click closes all")
     .click(function(e) {
       if(e.ctrlKey) {
         $(".ap_head_div").find(".info_div").remove();
         del_local(/^ap_info_/);
         del_local(/^graph_ap_/);
         return;
       };
       let ic=$(this).closest(".info_container");
       if(ic.length == 0) return;
       let id=$(this).closest(".ap_div").data("id");
       let local_key="ap_info_"+id;
       let idiv=ic.find(".info_div");
       if(idiv.length > 0) {
         del_local(local_key);
         del_local(new RegExp('^graph_ap_radio\\d_users_'+id));
         del_local(new RegExp('^graph_ap_radio\\d_counters_'+id));
         idiv.remove();
         return;
       };

       idiv=$(DIV)
        .addClass("info_div")
        .append( $(SPAN).text( pretty_MAC(data["aps"][id]["ap_mac"], ":") ).css({"margin-right": "2em", "font-family": "monospace"})
          .click(function(e) {
            e.stopPropagation();
            if(e.ctrlKey) {
              let id=$(this).closest(".ap_div").data("id");
              let j=jstr(data["aps"][id]);
              show_dialog(j);
            };
          })
        )
        .append( $(LABEL).addClass("ui-icon").addClass("ui-icon-clock-b").title("Uptime") )
        .append( $(SPAN).text( wdhm(data["aps"][id]["ap_attrs"]["ap_uptime"]/100) ).css({"margin-right": "2em", "margin-left": "0.3em"}) )
       ;

       idiv
        .append( $(LABEL).text("Site: ") )
        .append( $(SPAN).text(data["aps"][id]["ap_attrs"]["ap_site"]).css({"margin-right": "2em" }) )
        .append( $(LABEL).text("Serial: ") )
        .append( $(SPAN).text(data["aps"][id]["ap_attrs"]["ap_serial"]).css({"margin-right": "2em" }) )
       ;

       idiv
        .append( $(BR) )
        .append( $(LABEL).text("Net: ") )
        .append( $(SPAN).text(data["aps"][id]["ap_attrs"]["ap_netname"]).css({"margin-right": "2em" }) )
       ;

       idiv
        .append( $(BR) )
        .append( $(LABEL).text("Location: ") )
        .append( $(SPAN).text(data["aps"][id]["ap_attrs"]["ap_location"]).css({"margin-right": "2em" }) )
       ;

       idiv
        .append( $(BR) )
        .append( $(LABEL).text("Tshark: ") )
        .append( $(SPAN).text("tshark -n -l -O radius -R 'radius.Called_Station_Id contains \""+pretty_MAC(data["aps"][id]["ap_mac"], "-")+"\" 'udp port 1812 or udp port 1813'").css({"margin-right": "2em" }) )
       ;

       idiv
        .append( $(BR) )
        .append( $(LABEL).text("CDP: ") )
       ;

       let cdp_keys = keys(data["aps"][id]["ap_cdp_neighbours"]);
       if(cdp_keys.length == 1) {
         let nei_if_speed="?";
         let nei_if_speed_bg_color="#808080";

         if(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[0]]["cdp_nei_if_speed"] == "2") {
           nei_if_speed="10M";
           nei_if_speed_bg_color="#ffcccc";
         } else if(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[0]]["cdp_nei_if_speed"] == "3") {
           nei_if_speed="100M";
           nei_if_speed_bg_color="#ccffcc";
         } else if(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[0]]["cdp_nei_if_speed"] == "4") {
           nei_if_speed="1G";
           nei_if_speed_bg_color="#00ff00";
         } else if(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[0]]["cdp_nei_if_speed"] == "3") {
           nei_if_speed_bg_color="yellow";
           nei_if_speed="auto";
         };
         let nei_name=data["aps"][id]["ap_cdp_neighbours"][cdp_keys[0]]["cdp_nei_name"].replace(/\.[^.]+$/, "");
         idiv
          .append( $(SPAN).text(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[0]]["cdp_nei_address"]).css({"margin-right": "0.3em"}) )
          .append( $(A).text("SSH")
            .prop({"href": "ssh://"+data["aps"][id]["ap_cdp_neighbours"][cdp_keys[0]]["cdp_nei_address"]})
            .css({"margin-right": "1em"})
          )
          .append( $(SPAN)
            .text(nei_name)
            .css({"margin-right": "1em"})
            .title( data["aps"][id]["ap_cdp_neighbours"][cdp_keys[0]]["cdp_nei_platform"]
              +"\n"+data["aps"][id]["ap_cdp_neighbours"][cdp_keys[0]]["cdp_nei_caps"]
            )
          )
          .append( $(SPAN).text(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[0]]["cdp_nei_if_name"]).css({"margin-right": "1em"}) )
          .append( $(SPAN).text(nei_if_speed).css({"margin-right": "1em"}).css({"border": "1px solid black", "background-color": nei_if_speed_bg_color}) )
         ;
       } else {
         cdp_keys.sort(function(a,b) {
           if( data["aps"][id]["ap_cdp_neighbours"][a]["cdp_nei_caps"].match(/host/i) && !data["aps"][id]["ap_cdp_neighbours"][b]["cdp_nei_caps"].match(/host/i)) {
             return 1;
           } else if(data["aps"][id]["ap_cdp_neighbours"][b]["cdp_nei_caps"].match(/host/i) && !data["aps"][id]["ap_cdp_neighbours"][a]["cdp_nei_caps"].match(/host/i)) {
             return -1;
           } else {
             return num_compare(data["aps"][id]["ap_cdp_neighbours"][a]["cdp_nei_address"], data["aps"][id]["ap_cdp_neighbours"][b]["cdp_nei_address"]);
           };
         });

         var cdp_nei_list=$(DIV).addClass("cdp_neighbours").hide();
         idiv
          .append( $(LABEL).text(cdp_keys.length+" neighbours").addClass("button")
            .click(function() {
              $(this).closest("DIV").find(".cdp_neighbours").toggle();
            })
          )
          .append( cdp_nei_list )
         ;

         for(let cdpi in cdp_keys) {
           let nei_if_speed="?";
           let nei_if_speed_bg_color="#808080";

           if(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[cdpi]]["cdp_nei_if_speed"] == "2") {
             nei_if_speed="10M";
             nei_if_speed_bg_color="#ffcccc";
           } else if(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[cdpi]]["cdp_nei_if_speed"] == "3") {
             nei_if_speed="100M";
             nei_if_speed_bg_color="#ccffcc";
           } else if(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[cdpi]]["cdp_nei_if_speed"] == "4") {
             nei_if_speed="1G";
             nei_if_speed_bg_color="#00ff00";
           } else if(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[cdpi]]["cdp_nei_if_speed"] == "3") {
             nei_if_speed_bg_color="yellow";
             nei_if_speed="auto";
           };
           let nei_name=data["aps"][id]["ap_cdp_neighbours"][cdp_keys[cdpi]]["cdp_nei_name"].replace(/\.[^.]+$/, "");

           cdp_nei_list
            .append( $(SPAN).text(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[cdpi]]["cdp_nei_address"]).css({"margin-right": "0.3em"}) )
            .append( $(A).text("SSH")
              .prop({"href": "ssh://"+data["aps"][id]["ap_cdp_neighbours"][cdp_keys[cdpi]]["cdp_nei_address"]})
              .css({"margin-right": "1em"})
            )
            .append( $(SPAN)
              .text(nei_name)
              .css({"margin-right": "1em"})
              .title( data["aps"][id]["ap_cdp_neighbours"][cdp_keys[cdpi]]["cdp_nei_platform"]
                +"\n"+data["aps"][id]["ap_cdp_neighbours"][cdp_keys[cdpi]]["cdp_nei_caps"]
              )
            )
            .append( $(SPAN).text(data["aps"][id]["ap_cdp_neighbours"][cdp_keys[cdpi]]["cdp_nei_if_name"]).css({"margin-right": "1em"}) )
            .append( $(SPAN).text(nei_if_speed).css({"margin-right": "1em"}).css({"border": "1px solid black", "background-color": nei_if_speed_bg_color}) )
            .append( $(BR) )
           ;
         };
       };

       for(let r=0; r < data["aps"][id]["ap_attrs"]["ap_num_slots"]; r++) {
         let radio_div=$(DIV).addClass("radio_div")
          .data("id", r)
         ;
         let radio_type="UNKN";
         if(data["aps"][id]["ap_radio_attrs"][r]["r_type"] == "1") {
           radio_type="2.4Ghz";
         } else if(data["aps"][id]["ap_radio_attrs"][r]["r_type"] == "2") {
           radio_type="5Ghz";
         } else if(data["aps"][id]["ap_radio_attrs"][r]["r_type"] == "4") {
           radio_type="UWB";
         };

         radio_div
          .data("band", radio_type)
          .append( $(LABEL).text("Radio: ") )
          .append( $(SPAN).addClass("r_type_cont").append( $(LABEL).text(radio_type).addClass("radio_type") ) )
          .append( $(SPAN).addClass("min3em")
            .append( data["aps"][id]["ap_radio_attrs"][r]["r_state"] == 1?
              $(LABEL).text("OFF").addClass("radio_off"):
              $(LABEL).text("On").addClass("radio_on")
            )
          )
          .append( $(LABEL).text("Ch: ") )
          .append( $(SPAN).addClass("min2em").text(data["aps"][id]["ap_radio_attrs"][r]["r_channel"]) )
          .append( $(LABEL).text("Pwr: ") )
          .append( $(SPAN).addClass("min2em").text(data["aps"][id]["ap_radio_attrs"][r]["r_power"]).title("Power level, 1 - highest") )
          .append( $(LABEL).text("Users: ") )
          .append( $(SPAN).addClass("min2em").text(data["aps"][id]["ap_radio_attrs"][r]["r_users"]) )
          .append( !data["aps"][id]["rrd_file"]?$(LABEL):$(LABEL)
            .addClass("ui-icon").addClass("ui-icon-chart-line")
            .addClass("button").addClass("button_graph_r_users"+r)
            .click(function() {
              let subject_div = $(this).closest(".ap_div");
              let info_div = subject_div.find(".ap_head_div").find(".info_div");
              let id = subject_div.data("id");
              let radio_div = $(this).closest(".radio_div");
              let radio_id = radio_div.data("id");
              let band = radio_div.data("band");
              let graph_class = "graph_ap_radio"+radio_id+"_users";
              let local_key = graph_class+"_"+id;

              if(subject_div.find("."+graph_class).length > 0) {
                subject_div.find("."+graph_class).find(".close").trigger("click");
                return;
              };

              let graph_keys={};
              graph_keys["r_users_"+radio_id] = {
                "_order": 1,
                "label": "Пользователи "+band,
                "color": "blue",
                "borderColor": "blue",
                "borderWidth": 1,
                "backgroundColor": "blue",
                "yAxisID": "y",
              };

              let graph_options={
                "options": {
                  "scales": {
                    "y": {
                      "type": "linear",
                      "display": true,
                      "position": "left",
                    },
                  },
                },
              };


              let graph_div=get_graph_div('Пользователи '+band, graph_class, "ap", id, graph_keys, graph_options, local_key)
               .css({"background-color": "white"})
               .appendTo(info_div)
              ;
              graph_div.find(".refresh").trigger("click");
              save_local(local_key, true);
            })
          )
          .append( $(SPAN).addClass("min1em") )
          .append( $(LABEL).text("Counters: ") )
          .append( $(LABEL).text("ACKF: ").title("ACK fail") )
          .append( $(SPAN).addClass("min4em").text(GMK(data["aps"][id]["ap_radio_attrs"][r]["r_ack_fail_cnt"])).title("ACK fail") )
          .append( $(LABEL).text("d11F: ").title(".11 Fail") )
          .append( $(SPAN).addClass("min4em").text(GMK(data["aps"][id]["ap_radio_attrs"][r]["r_d11_fail_cnt"])).title(".11 Fail") )
          .append( $(LABEL).text("DUP: ").title("Duplicates") )
          .append( $(SPAN).addClass("min4em").text(GMK(data["aps"][id]["ap_radio_attrs"][r]["r_dup_cnt"])).title("Duplicates") )
          .append( $(LABEL).text("FCSE: ").title("FCS errors") )
          .append( $(SPAN).addClass("min4em").text(GMK(data["aps"][id]["ap_radio_attrs"][r]["r_fcs_error_cnt"])).title("FCS errors") )
          .append( $(LABEL).text("RETR: ").title("Retries") )
          .append( $(SPAN).addClass("min4em").text(GMK(data["aps"][id]["ap_radio_attrs"][r]["r_retry_cnt"])).title("Retries") )
          .append( $(LABEL).text("RTSF: ").title("RTS Fail") )
          .append( $(SPAN).addClass("min4em").text(GMK(data["aps"][id]["ap_radio_attrs"][r]["r_rts_fail_cnt"])).title("RTS Fail") )
          .append( $(LABEL).text("RTSS: ").title("RTS Success") )
          .append( $(SPAN).addClass("min4em").text(GMK(data["aps"][id]["ap_radio_attrs"][r]["r_rts_succ_cnt"])).title("RTS Success") )
          .append( !data["aps"][id]["rrd_file"]?$(LABEL):$(LABEL)
            .addClass("ui-icon").addClass("ui-icon-chart-line")
            .addClass("button").addClass("button_graph_r_counters"+r)
            .click(function() {
              let subject_div = $(this).closest(".ap_div");
              let info_div = subject_div.find(".ap_head_div").find(".info_div");
              let id = subject_div.data("id");
              let radio_div = $(this).closest(".radio_div");
              let radio_id = radio_div.data("id");
              let band = radio_div.data("band");
              let graph_class = "graph_ap_radio"+radio_id+"_counters";
              let local_key = graph_class+"_"+id;

              if(subject_div.find("."+graph_class).length > 0) {
                subject_div.find("."+graph_class).find(".close").trigger("click");
                return;
              };

              let graph_keys={};
              graph_keys["r_ack_fail_cnt_"+radio_id] = {
                "_order": 1,
                "label": "ACK Fail",
                "color": "blue",
                "borderColor": "blue",
                "borderWidth": 1,
                "backgroundColor": "blue",
                "yAxisID": "y",
              };

              graph_keys["r_d11_fail_cnt_"+radio_id] = {
                "_order": 2,
                "label": "Dot11 Fail",
                "color": "red",
                "borderColor": "red",
                "borderWidth": 1,
                "backgroundColor": "red",
                "yAxisID": "y",
              };
              graph_keys["r_dup_cnt_"+radio_id] = {
                "_order": 3,
                "label": "Duplicates",
                "color": "yellow",
                "borderColor": "yellow",
                "borderWidth": 1,
                "backgroundColor": "yellow",
                "yAxisID": "y",
              };
              graph_keys["r_fcs_error_cnt_"+radio_id] = {
                "_order": 4,
                "label": "FCS Error",
                "color": "darkorange",
                "borderColor": "darkorange",
                "borderWidth": 1,
                "backgroundColor": "darkorange",
                "yAxisID": "y",
              };
              graph_keys["r_retry_cnt_"+radio_id] = {
                "_order": 5,
                "label": "Retries",
                "color": "purple",
                "borderColor": "purple",
                "borderWidth": 1,
                "backgroundColor": "purple",
                "yAxisID": "y",
              };
              graph_keys["r_rts_fail_cnt_"+radio_id] = {
                "_order": 6,
                "label": "RTS Fail",
                "color": "brown",
                "borderColor": "brown",
                "borderWidth": 1,
                "backgroundColor": "brown",
                "yAxisID": "y",
              };
              graph_keys["r_rts_succ_cnt_"+radio_id] = {
                "_order": 7,
                "label": "RTS Success",
                "color": "green",
                "borderColor": "green",
                "borderWidth": 1,
                "backgroundColor": "green",
                "yAxisID": "y",
              };
              let graph_options={
                "options": {
                  "scales": {
                    "y": {
                      "type": "linear",
                      "display": true,
                      "position": "left",
                    },
                  },
                },
              };


              let graph_div=get_graph_div('Счетчики '+band, graph_class, "ap", id, graph_keys, graph_options, local_key)
               .css({"background-color": "white"})
               .appendTo(info_div)
              ;
              graph_div.find(".refresh").trigger("click");
              save_local(local_key, true);
            })
          )
          .appendTo(idiv)
         ;
       };

       idiv.appendTo(ic);
       save_local(local_key, true);
     })
   )
   .append( $(LABEL).text( data["aps"][ap_id]["ap_attrs"]["ap_ip"] )
     .css({"margin-right": "1em", "margin-left": "1em", "min-width": "8em", "display": "inline-block"})
     .title( "MAC: "+pretty_MAC(data["aps"][ap_id]["ap_attrs"]["ap_mac"], ":")
       +"\nSite: "+data["aps"][ap_id]["ap_attrs"]["ap_site"]
       +"\nNet: "+data["aps"][ap_id]["ap_attrs"]["ap_netname"]
     )
     .append( data["aps"][ap_id]["ap_attrs"]["ap_site"] != 'nosite'? $(LABEL) :
       $(LABEL)
        .addClass("nosite")
        .addClass("ui-icon")
        .addClass("ui-icon-notice")
        .addClass("ui-state-error")
     )
     .append( data["aps"][ap_id]["ap_attrs"]["ap_site"] == data["wlcs"][wlc_ip]["site"]? $(LABEL) :
       $(LABEL).title("Offsite")
        .addClass("offsite")
        .addClass("ui-icon")
        .addClass("ui-icon-globe-b")
     )
   )
   .append( $(LABEL).text( data["aps"][ap_id]["ap_attrs"]["ap_model"] )
     .css({"margin-right": "2em", "min-width": "10em", "display": "inline-block"})
     .title( "Serial: "+data["aps"][ap_id]["ap_attrs"]["ap_serial"] )
   )
   .append( $(LABEL).text( data["aps"][ap_id]["ap_attrs"]["ap_name"] ).css({"margin-right": "2em"})
     .title( "Location: "+data["aps"][ap_id]["ap_attrs"]["ap_location"] )
   )
   .appendTo( ap_div )
  ;

  if(data["aps"][ap_id]["ap_attrs"]["ap_site"] != data["wlcs"][wlc_ip]["site"]) {
    ap_search_array.push("offsite");
  } else {
    ap_search_array.push("onsite");
  };

//data["aps"][ap_id]["status"] = "offline";
  if(data["aps"][ap_id]["status"] == "online") {
    ap_head.css({"background-color": "#FFFFCC"})
  } else {
    if(data["aps"][ap_id]["status"] == "offline") {
      ap_head.append( $(LABEL).text("offline").addClass("offline_ap") );
      ap_head.append( $(SPAN).text( " "+from_unix_time( data["aps"][ap_id]["last_ok"]) ) )
      ap_div.css({"background-color": "lightpink"})
    } else {
      ap_head.append( $(LABEL).text("unknown").addClass("unknown_ap") );
      ap_div.css({"background-color": "lightgray"})
    };
  };

  ap_head
   .append( $(SPAN).addClass("head_buttons_spacer") )
   .append( $(LABEL).addClass("to_filter_head_button").addClass("ui-icon").addClass("ui-icon-zoomequal")
     .addClass("button")
     .title("Добавить к фильтру")
     .click(function() {
       let id=$(this).closest(".ap_div").data("id");
       let mac=data["aps"][id]["ap_mac"];

       let filter=$("#ap_filter").val()+"|"+mac;
       $("#ap_filter").val(filter).trigger("change");
     })
   )
  ;

  if(get_local("ap_info_"+ap_id, false)) {
    ap_head.find(".info_button").trigger("click");

    for(let r=0; r < data["aps"][ap_id]["ap_attrs"]["ap_num_slots"]; r++) {
      if(get_local("graph_ap_radio"+r+"_users"+"_"+ap_id, false)) {
        ap_head.find(".button_graph_r_users"+r).trigger("click");
      };
      if(get_local("graph_ap_radio"+r+"_counters"+"_"+ap_id, false)) {
        ap_head.find(".button_graph_r_counters"+r).trigger("click");
      };
    };
  };

  ap_div
   .data("search", ap_search_array)
  ;

  return ap_div;
};

function mac_event(ev) {
  let ret=$(DIV).addClass("event_div");

  ret.data("data", ev);

  ret
   .append( $(SPAN).text(from_unix_time(ev["time"])).addClass("event_time")
     .click(function(e) {
       if(!e.ctrlKey) return;
       let ev=$(this).closest(".event_div").data("data");
       show_dialog(jstr(ev));
     })
   )
  ;

  let event_type=$(SPAN).addClass("event_type").text("unknown");
  let event_cont=$(SPAN).addClass("event_cont");

  switch(ev["event_type"]) {
  case "trap": {
      let ssid="???";
      let auth_state=$(SPAN).addClass("event_auth_state").text("???").title("Не учтенное интерфейсом событие");
      let trap=ev["event"];
      let trap_data=[];
      switch(trap["snmpTrapOID"]) {
      case "ciscoLwappDot11ClientMovedToRunState":
        {
          ssid = trap["cldcClientSSID"];
          event_type.text("Авторизация (T)").title("Устройство авторизовалось. Trap");
          auth_state.text("Авт").addClass("auth_client").title("Авторизован");
          let ap_name = trap["cLApName"];
          let ap_mac = trap["cldcApMacAddress"];
          trap_data.push( $(SPAN).text(ap_name).title(ap_mac) );
          let ap_radio="5G";
          if(trap["cLApDot11IfSlotId"] == "0") {
            ap_radio="2.4G";
          };

          trap_data.push( $(SPAN).text(ap_radio).addClass("radio_type") );
        };
        break;
      case "bsnDot11StationAssociate":
        {
          event_type.text("Подключение (T)").title("Устройство подключилось. Trap");
          auth_state.text("н/д").addClass("unauth_client").title("Нет даных");
          let ap_name = trap["bsnAPName"];
          let ap_mac = trap["bsnStationAPMacAddr"];
          trap_data.push( $(SPAN).text(ap_name).title(ap_mac) );
          let ap_radio="5G";

          if(trap["bsnStationAPIfSlotId"] == "0") {
            ap_radio="2.4G";
          };

          trap_data.push( $(SPAN).text(ap_radio).addClass("radio_type") );
        };
        break;
      case "bsnDot11StationDeauthenticate":
        {
          event_type.text("Отключение (T)").title("Устройство отключилось. Trap");
          auth_state.text("н/д").addClass("auth_client").title("Нет даных");
          let ap_name = trap["bsnAPName"];
          let ap_mac = trap["bsnStationAPMacAddr"];
          trap_data.push( $(SPAN).text(ap_name).title(ap_mac) );
          let ap_radio="5G";

          if(trap["bsnStationAPIfSlotId"] == "0") {
            ap_radio="2.4G";
          };

          trap_data.push( $(SPAN).text(ap_radio).addClass("radio_type") );
        };
        break;
      case "bsnDot11StationAuthenticateFail":
        {
          event_type.text("Ошибка авторизации (T)").title("Ошибка авторизации. Trap");
          auth_state.text("н/д").addClass("unauth_client").title("Нет даных");
          let ap_name = trap["bsnAPName"];
          let ap_mac = trap["bsnStationAPMacAddr"];
          trap_data.push( $(SPAN).text(ap_name).title(ap_mac) );
          let ap_radio="5G";

          if(trap["bsnStationAPIfSlotId"] == "0") {
            ap_radio="2.4G";
          };

          trap_data.push( $(SPAN).text(ap_radio).addClass("radio_type") );
        };
        break;
      default:
        {
          auth_state.addClass("unauth_client");
          trap_data.push( $(SPAN).text(trap["snmpTrapOID"]) );
        }
      };

      event_cont
       .append( $(SPAN).text(ssid) )
       .append( auth_state )
      ;

      for(let i in trap_data) {
        event_cont.append( trap_data[i] );
      };
    }
    break
  case "roam": {
    let client=ev["event"]["client"];

    let auth_state=$(SPAN).addClass("event_auth_state");

    if(client["client_attrs"]["cl_pol_status"] == "0") {
      auth_state.text("Авт").addClass("auth_client").title("Авторизован");
    } else {
      auth_state.text("НАвт").addClass("unauth_client").title("Не авторизован");
    };

    event_type.text("Роаминг").title("Смена точки доступа или радио-диапазона");

    let prev_ap_name=ev["event"]["PrevAP_MAC"];
    if(typeof(apsByMac[ ev["event"]["PrevAP_MAC"] ]) !== 'undefined') {
      let prev_ap_id = apsByMac[ ev["event"]["PrevAP_MAC"] ];
      prev_ap_name = data["aps"][prev_ap_id]["ap_attrs"]["ap_name"];
    };

    let prev_ap_radio="5G";

    if(ev["event"]["PrevAP_Radio"] == "0") {
      prev_ap_radio="2.4G";
    };

    event_cont
     .append( $(SPAN).text(client["client_attrs"]["cl_ssid_name"]) )
     .append( auth_state )
     .append( $(SPAN).text(prev_ap_name).title(ev["event"]["PrevAP_MAC"]) )
     .append( $(SPAN).text(prev_ap_radio).addClass("radio_type") )
     .append( $(SPAN).addClass("ui-icon").addClass("ui-icon-arrow-r") )
    ;

    let new_ap_mac = client["client_attrs"]["cl_ap_mac"];
    if(ev["event"]["PrevAP_MAC"] != new_ap_mac) {
      let new_ap_name=new_ap_mac;
      if(typeof(apsByMac[ new_ap_mac ]) !== 'undefined') {
        let new_ap_id = apsByMac[ new_ap_mac ];
        new_ap_name = data["aps"][new_ap_id]["ap_attrs"]["ap_name"];
      };

      event_cont
       .append( $(SPAN).text(new_ap_name).title(new_ap_mac) )
      ;
    };

    let new_ap_radio="5G";

    if(client["client_attrs"]["cl_ap_radio"] == "0") {
      new_ap_radio="2.4G";
    };

    event_cont
     .append( $(SPAN).text(new_ap_radio).addClass("radio_type") )
    ;
    }
    break;
  case "connect": {
    let client=ev["event"];

    let auth_state=$(SPAN).addClass("event_auth_state");

    if(client["client_attrs"]["cl_pol_status"] == "0") {
      auth_state.text("Авт").addClass("auth_client").title("Авторизован");
    } else {
      auth_state.text("НАвт").addClass("unauth_client").title("Не авторизован");
    };

    event_type.text("Подключение").title("Устройство подключилось");
    let ap_mac = client["client_attrs"]["cl_ap_mac"];
    let ap_name=ap_mac;
    if(typeof(apsByMac[ ap_mac ]) !== 'undefined') {
      let ap_id = apsByMac[ ap_mac ];
        ap_name = data["aps"][ap_id]["ap_attrs"]["ap_name"];
      };

    event_cont
     .append( $(SPAN).text(client["client_attrs"]["cl_ssid_name"]) )
     .append( auth_state )
     .append( $(SPAN).text(ap_name).title(ap_mac) )
    ;

    let ap_radio="5G";

    if(client["client_attrs"]["cl_ap_radio"] == "0") {
      ap_radio="2.4G";
    };

    event_cont
     .append( $(SPAN).text(ap_radio).addClass("radio_type") )
    ;
    }
    break;
  case "disconnect": {
    let client=ev["event"];

    let auth_state=$(SPAN).addClass("event_auth_state");

    if(client["client_attrs"]["cl_pol_status"] == "0") {
      auth_state.text("Авт").addClass("auth_client").title("Авторизован");
    } else {
      auth_state.text("НАвт").addClass("unauth_client").title("Не авторизован");
    };

    event_type.text("Отключение").title("Устройство отключилось от сети");
    let ap_mac = client["client_attrs"]["cl_ap_mac"];
    let ap_name=ap_mac;
    if(typeof(apsByMac[ ap_mac ]) !== 'undefined') {
      let ap_id = apsByMac[ ap_mac ];
        ap_name = data["aps"][ap_id]["ap_attrs"]["ap_name"];
      };

    event_cont
     .append( $(SPAN).text(client["client_attrs"]["cl_ssid_name"]) )
     .append( auth_state )
     .append( $(SPAN).text(ap_name).title(ap_mac) )
    ;

    let ap_radio="5G";

    if(client["client_attrs"]["cl_ap_radio"] == "0") {
      ap_radio="2.4G";
    };

    event_cont
     .append( $(SPAN).text(ap_radio).addClass("radio_type") )
    ;
    }
    break;
  case "auth": {
    let client=ev["event"];

    let auth_state=$(SPAN).addClass("event_auth_state");

    if(client["client_attrs"]["cl_pol_status"] == "0") {
      event_type.text("Авторизация").title("Устройство авторизовалось");
      auth_state.text("Авт").addClass("auth_client").title("Авторизован");
    } else {
      event_type.text("Деавторизация").title("Устройство потеряло авторизацию");
      auth_state.text("НАвт").addClass("unauth_client").title("Не авторизован");
    };

    let ap_mac = client["client_attrs"]["cl_ap_mac"];
    let ap_name=ap_mac;
    if(typeof(apsByMac[ ap_mac ]) !== 'undefined') {
      let ap_id = apsByMac[ ap_mac ];
        ap_name = data["aps"][ap_id]["ap_attrs"]["ap_name"];
      };

    event_cont
     .append( $(SPAN).text(client["client_attrs"]["cl_ssid_name"]) )
     .append( auth_state )
     .append( $(SPAN).text(ap_name).title(ap_mac) )
    ;

    let ap_radio="5G";

    if(client["client_attrs"]["cl_ap_radio"] == "0") {
      ap_radio="2.4G";
    };

    event_cont
     .append( $(SPAN).text(ap_radio).addClass("radio_type") )
    ;
    }
    break;
  default:
    event_cont.text("unknown");
  };

  ret.append( event_type );
  ret.append( event_cont );
  return ret;
};

function show_user_events(user) {
  if($("#window_user_events_"+$.escapeSelector(user)).length > 0) {
    return;
  };
  setTimeout(function() {

    let dialog=$(DIV).addClass("dialog_start").title("Журнал пользователя: "+user)
     .prop("id", "window_user_events_"+user)
     .data("local_key", "window_user_events_"+user)
     //.css({"min-width": "800px", "min-height": "600px"})
     //.css({"display": "inline-block"})
     .css({"white-space": "pre"})
    ;

    dialog
     .append( $(DIV).addClass("dialog_head")
       .append( $(LABEL).addClass("button").addClass("ui-icon").addClass("ui-icon-arrowrefresh-1-s").title("Обновить").addClass("events_refresh") )
       .append( $(SPAN).addClass("min1em") )
       .append( $(SPAN).addClass("user_name") )
     )
     .append( $(DIV).addClass("dialog_contents").text("Загрузка данных ...")
     )
    ;

    dialog.find(".events_refresh")
     .click(function() {
       let dialog=$(this).closest(".dialog_start");
       run_query({"action": "get_user_events", "user": user}, function(res) {
         let prev_contents = dialog.find(".dialog_contents");

         let contents=$(DIV).addClass(".dialog_contents");
         let events_div=$(DIV).addClass("events_div").appendTo(contents);

         if(res["ok"]["user_name"] != "") {
           dialog.find(".dialog_head").find(".user_name")
            .empty()
            .append( $(SPAN).text(res["ok"]["user_name"]) )
           ;
         };

         $("#debug_win").text(jstr(res["ok"]));

         for(let ei in res["ok"]["events"]) {
           let ev = res["ok"]["events"][ei];
           let _mac_event=mac_event(ev);
           let client_mac;
           if(ev["event_type"] == "roam") {
             client_mac=pretty_MAC(ev["event"]["client"]["client_mac"], ":");
           } else if(ev["event_type"] == "trap") {
             if(typeof(ev["event"]["cldcClientMacAddress"]) !== 'undefined') {
               client_mac=pretty_MAC(ev["event"]["cldcClientMacAddress"], ":");
             } else if(typeof(ev["event"]["bsnStationMacAddress"]) !== 'undefined') {
               client_mac=pretty_MAC(ev["event"]["bsnStationMacAddress"], ":");
             } else {
               client_mac="??:??:??:??:??:??";
             };

           } else {
             client_mac=pretty_MAC(ev["event"]["client_mac"], ":");
           };

           $(SPAN).addClass("event_mac").text(client_mac).insertAfter( _mac_event.find(".event_type") );
           events_div.append( _mac_event );
         };

         prev_contents.replaceWith(contents);

         dialog.dialog({ position: {"my": "center", "at": "center", "of": window}});
       })
     })
    ;

    let dialog_options = {
      close: function() {
        let local_key=$(this).data("local_key");
        del_local(local_key);
        $(this).dialog("destroy");
        $(this).remove();
      },
      width: "auto",
      maxWidth: 1000,
      maxHeight: 900,
      minWidth: 600,
      minHeight: 400,
    };

    dialog.appendTo("BODY");

    dialog.dialog(dialog_options);

    dialog.find(".events_refresh").trigger("click");
  }, 0);
};

function show_mac_events(mac) {
  if($("#window_mac_events_"+mac).length > 0) {
    return;
  };
  setTimeout(function() {

    let dialog=$(DIV).addClass("dialog_start").title("Журнал MAC: "+pretty_MAC(mac,":"))
     .prop("id", "window_mac_events_"+mac)
     .data("local_key", "window_mac_events_"+mac)
     //.css({"min-width": "800px", "min-height": "600px"})
     //.css({"display": "inline-block"})
     .css({"white-space": "pre"})
    ;

    dialog
     .append( $(DIV).addClass("dialog_head")
       .append( $(LABEL).addClass("button").addClass("ui-icon").addClass("ui-icon-arrowrefresh-1-s").title("Обновить").addClass("events_refresh") )
       .append( $(SPAN).addClass("min1em") )
       .append( $(SPAN).addClass("user_name") )
     )
     .append( $(DIV).addClass("dialog_contents").text("Загрузка данных ...")
     )
    ;

    dialog.find(".events_refresh")
     .click(function() {
       let dialog=$(this).closest(".dialog_start");
       run_query({"action": "get_mac_events", "mac": mac}, function(res) {
         let prev_contents = dialog.find(".dialog_contents");

         let contents=$(DIV).addClass(".dialog_contents");
         let events_div=$(DIV).addClass("events_div").appendTo(contents);

         if(res["ok"]["mac_info"].length == 1) {
           dialog.find(".dialog_head").find(".user_name")
            .empty()
            .append( $(SPAN).text(res["ok"]["mac_info"][0]["dspn"]).title(res["ok"]["mac_info"][0]["reas"]) )
            .append( $(SPAN).addClass("min1em") )
            .append( $(SPAN).text(res["ok"]["mac_info"][0]["usrn"]).title(res["ok"]["mac_info"][0]["reas"]) )
           ;
         };

         $("#debug_win").text(jstr(res["ok"]));

         for(let ei in res["ok"]["events"]) {
           let ev = res["ok"]["events"][ei];
           events_div.append( mac_event(ev) );
         };

         prev_contents.replaceWith(contents);

         dialog.dialog({ position: {"my": "center", "at": "center", "of": window}});
       })
     })
    ;

    let dialog_options = {
      close: function() {
        let local_key=$(this).data("local_key");
        del_local(local_key);
        $(this).dialog("destroy");
        $(this).remove();
      },
      width: "auto",
      maxWidth: 1000,
      maxHeight: 900,
      minWidth: 600,
      minHeight: 400,
    };

    dialog.appendTo("BODY");

    dialog.dialog(dialog_options);

    dialog.find(".events_refresh").trigger("click");
  }, 0);
};

function get_client_div(client_id) {

  let client_mac=pretty_MAC(data["clients"][client_id]["client_mac"], ":");

  let client_search_array=[];

  client_search_array.push(data["clients"][client_id]["client_mac"].toLowerCase());

  for(let cmii in data["clients"][client_id]["client_mac_info"]) {
    client_search_array.push(data["clients"][client_id]["client_mac_info"][cmii]["usrn"].toLowerCase());
    client_search_array.push(data["clients"][client_id]["client_mac_info"][cmii]["dspn"].toLowerCase());
    if(data["clients"][client_id]["client_mac_info"][cmii]["reas"] != "") {
      client_search_array.push(data["clients"][client_id]["client_mac_info"][cmii]["reas"].toLowerCase());
    };
  };
  if(data["clients"][client_id]["client_attrs"]["cl_user"] != "") {
    client_search_array.push(data["clients"][client_id]["client_attrs"]["cl_user"].toLowerCase());
  };
  if(data["clients"][client_id]["client_attrs"]["cl_ip"] != "") {
    client_search_array.push(data["clients"][client_id]["client_attrs"]["cl_ip"].toLowerCase());
  };

  if(data["clients"][client_id]["client_attrs"]["cl_site"] != "") {
    client_search_array.push(data["clients"][client_id]["client_attrs"]["cl_site"].toLowerCase());
  };

  if(data["clients"][client_id]["client_attrs"]["cl_vendor"] != "") {
    client_search_array.push(data["clients"][client_id]["client_attrs"]["cl_vendor"].toLowerCase());
  };


  let client_user=data["clients"][client_id]["client_attrs"]["cl_user"];
  let client_name="нет даных";
  let client_reason=""

  if(client_user != "") {
    let found=false;
    for(let cmii in data["clients"][client_id]["client_mac_info"]) {
      if(data["clients"][client_id]["client_mac_info"][cmii]["usrn"].toLowerCase().localeCompare( client_user.toLowerCase() ) == 0) {
        client_name = data["clients"][client_id]["client_mac_info"][cmii]["dspn"];
        client_reason = data["clients"][client_id]["client_mac_info"][cmii]["reas"];
        found=true;
        break;
      };
    };
    if(!found) {
      client_search_array.push("nomacinfo");
    };
  } else {
    if(data["clients"][client_id]["client_mac_info"].length == 1) {
      client_user = data["clients"][client_id]["client_mac_info"][0]["usrn"];
      client_name = data["clients"][client_id]["client_mac_info"][0]["dspn"];
    } else if(data["clients"][client_id]["client_mac_info"].length > 1) {
      let logins_a=[];
      client_search_array.push("multiclient");
      for(let cmii in data["clients"][client_id]["client_mac_info"]) {
        logins_a.push(data["clients"][client_id]["client_mac_info"][cmii]["usrn"]);
      };
      client_user = logins_a.join(",");
      client_name = "один из"
    } else {
      client_search_array.push("nomacinfo");
      client_user = "unknown";
    };
  };

  let wlc_ip=data["clients"][client_id]["client_wlc"];
  let cl_site=data["clients"][client_id]["client_attrs"]["cl_site"];

  let client_div=$(DIV).addClass("client_div")
   .data("id", client_id)
   .data("data", data["clients"][client_id])
   .append( $(LABEL).addClass("button").addClass("ui-icon").addClass("ui-icon-history").title("Журнал событий")
     .css({"margin-right": "0.5em"})
     .click(function() {
       let id=$(this).closest(".client_div").data("id");
       show_mac_events(data["clients"][id]["client_mac"]);
     })
   )
   .append( $(LABEL).text( client_mac ).css({"margin-right": "2em", "font-family": "monospace"})
     .title(data["clients"][client_id]["client_attrs"]["cl_vendor"])
     .click(function(e) {
       e.stopPropagation();
       if(e.ctrlKey) {
         let j=jstr($(this).closest(".client_div").data("data"));
         show_dialog(j);
       };
     })
   )
   .append( $(LABEL).text( data["clients"][client_id]["client_attrs"]["cl_ip"] )
     .css({"margin-right": "1em", "display": "inline-block", "min-width": "8em"})
     .title("Site: "+data["clients"][client_id]["client_attrs"]["cl_site"]
       +"\nNet: "+data["clients"][client_id]["client_attrs"]["cl_netname"]
     )
     .append( cl_site != 'nosite'? $(LABEL) :
       $(LABEL)
        .addClass("nosite")
        .addClass("ui-icon")
        .addClass("ui-icon-notice")
        .addClass("ui-state-error")
     )
     .append( (cl_site == data["wlcs"][wlc_ip]["site"] || cl_site == "null" || cl_site == "nosite")? $(LABEL) :
       $(LABEL).title("Local switched")
        .addClass("offsite")
        .addClass("ui-icon")
        .addClass("ui-icon-globe-b")
     )
   )
   //.append( $(LABEL).text( "Uptime: " ) )
   .append( $(LABEL).addClass("ui-icon").addClass("ui-icon-clock-b").title("Uptime") )
   .append( $(SPAN).text( wdhm(data["clients"][client_id]["client_attrs"]["cl_uptime"]) ).css({"margin-right": "2em", "margin-left": "0.3em"}) )
   .append( $(LABEL).text( client_name ).css({"margin-right": "2em"}).title(client_reason) )
   .append( $(LABEL).text( client_user ).css({"margin-right": "2em", "visibility": "hidden"}) )
  ;

  if(cl_site != "null" && cl_site != "nosite") {
    if(data["clients"][client_id]["client_attrs"]["cl_site"] != data["wlcs"][wlc_ip]["site"]) {
      client_search_array.push("localswithed");
    } else {
      client_search_array.push("centralswitched");
    };
  };

  if( data["clients"][client_id]["client_attrs"]["cl_pol_status"] == "0") {
    client_div.addClass("auth_client");
  } else {
    client_div.addClass("unauth_client");
  };


  client_div
   .append( $(SPAN).addClass("head_buttons_spacer") )
   .append( $(LABEL).addClass("to_filter_head_button").addClass("ui-icon").addClass("ui-icon-zoomequal")
     .addClass("button")
     .title("Добавить к фильтру")
     .click(function() {
       let id=$(this).closest(".client_div").data("id");
       let mac=data["clients"][id]["client_mac"];

       let filter=$("#user_filter").val()+"|"+mac;
       $("#user_filter").val(filter).trigger("change");
     })
   )
   .append( $(LABEL).text( client_user ).css({"margin-right": "2em", "float": "right"}).title(client_reason) )
   .append( data["clients"][client_id]["client_attrs"]["cl_user"] == "" ? $(LABEL) : $(LABEL).addClass("button").addClass("ui-icon").addClass("ui-icon-history").title("Журнал событий")
     .css({"margin-right": "0.5em", "float": "right"})
     .click(function() {
       let id=$(this).closest(".client_div").data("id");
       show_user_events(data["clients"][id]["client_attrs"]["cl_user"]);
     })
   )
  ;

  let signal_class="good_signal";

  if(Number(data["clients"][client_id]["client_attrs"]["cl_rssi"]) >= -65) {
    signal_class="good_signal";
  } else if(Number(data["clients"][client_id]["client_attrs"]["cl_rssi"]) >= -80) {
    signal_class="medium_signal";
  } else {
    signal_class="bad_signal";
  };

  client_div
   .append( $(BR) )
   .append( $(LABEL).text("RSSI/SNR: ")
   )
   .append( $(SPAN).addClass(signal_class).addClass("signal")
     .text(data["clients"][client_id]["client_attrs"]["cl_rssi"]
       +"/"+data["clients"][client_id]["client_attrs"]["cl_snr"]
     )
   )
   .append( !data["clients"][client_id]["rrd_file"]?$(LABEL):$(LABEL)
     .addClass("ui-icon").addClass("ui-icon-chart-line")
     .addClass("button").addClass("button_graph_signal")
     .click(function() {
       let subject_div=$(this).closest(".client_div");
       let info_div=subject_div;
       let id=subject_div.data("id");
       let graph_class="graph_client_signal";
       let local_key=graph_class+"_"+id;

       if(subject_div.find("."+graph_class).length > 0) {
         subject_div.find("."+graph_class).find(".close").trigger("click");
         return;
       };

       let graph_keys={
         "cl_rssi": {
           "_order": 1,
           "label": "RSSI",
           "color": "blue",
           "borderColor": "blue",
           "borderWidth": 1,
           "backgroundColor": "blue",
           "yAxisID": "y",
         },
         "cl_snr": {
           "_order": 2,
           "label": "SNR",
           "color": "cyan",
           "borderColor": "cyan",
           "borderWidth": 1,
           "backgroundColor": "cyan",
           "yAxisID": "y1",
         },
       };

       let graph_options={
         "options": {
           "scales": {
             "y": {
               "type": "linear",
               "display": true,
               "position": "left",
             },
             "y1": {
               "type": "linear",
               "display": true,
               "position": "right",
               "grid": { "drawOnChartArea": false },
               "beginAtZero": true
             },
           },
         },
       };
               

       let graph_div=get_graph_div('Качество сигнала', graph_class, "client", id, graph_keys, graph_options, local_key)
        .css({"background-color": "white"})
        .appendTo(info_div)
       ;
       graph_div.find(".refresh").trigger("click");
       save_local(local_key, true);
     })
   )
  ;

  let cl_status="unkn";
  let cl_status_title="Unknown!";
  let cl_status_color="#202020";

  if(data["clients"][client_id]["client_attrs"]["cl_status"] == "0") {
    cl_status="idle";
    cl_status_title="Idle";
    cl_status_color="darkorange";
  } else if(data["clients"][client_id]["client_attrs"]["cl_status"] == "1") {
    cl_status="aaaPend";
    cl_status_title="AAA pending";
    cl_status_color="darkorange";
  } else if(data["clients"][client_id]["client_attrs"]["cl_status"] == "2") {
    cl_status="auth";
    cl_status_title="Authenticated";
    cl_status_color="darkorange";
  } else if(data["clients"][client_id]["client_attrs"]["cl_status"] == "3") {
    cl_status="assoc";
    cl_status_title="Associated";
    cl_status_color="green";
  } else if(data["clients"][client_id]["client_attrs"]["cl_status"] == "4") {
    cl_status="pwsave";
    cl_status_title="Powersave";
    cl_status_color="darkorange";
  } else if(data["clients"][client_id]["client_attrs"]["cl_status"] == "5") {
    cl_status="diss";
    cl_status_title="Disassociated";
    cl_status_color="darkorange";
  } else if(data["clients"][client_id]["client_attrs"]["cl_status"] == "6") {
    cl_status="del";
    cl_status_title="To be deleted";
    cl_status_color="darkorange";
  } else if(data["clients"][client_id]["client_attrs"]["cl_status"] == "7") {
    cl_status="probe";
    cl_status_title="Probing";
    cl_status_color="darkorange";
  } else if(data["clients"][client_id]["client_attrs"]["cl_status"] == "8") {
    cl_status="blist";
    cl_status_title="Blacklisted";
    cl_status_color="darkorange";
  };

  let cl_pol_state_color="darkorange";
  if(data["clients"][client_id]["client_attrs"]["cl_pol_state"] == "RUN") {
    cl_pol_state_color="green";
  };

  client_div
   .append( $(LABEL).css({"display": "inline-block", "min-width": "1em"}) )
   .append( $(SPAN).text("Status: ") )
   .append( $(SPAN).text(cl_status).title(cl_status_title).css({"color": cl_status_color}) )
   .append( $(SPAN).text("/") )
   .append( $(SPAN).text(data["clients"][client_id]["client_attrs"]["cl_pol_state"]).css({"color": cl_pol_state_color}) )
  ;

  let cl_radio="n/d";

  if(data["clients"][client_id]["client_attrs"]["cl_radio"] == "1") {
    cl_radio=".11a 5Ghz";
  } else if(data["clients"][client_id]["client_attrs"]["cl_radio"] == "2") {
    cl_radio=".11b 2.4Ghz";
  } else if(data["clients"][client_id]["client_attrs"]["cl_radio"] == "3") {
    cl_radio=".11g 2.4Ghz";
  } else if(data["clients"][client_id]["client_attrs"]["cl_radio"] == "4") {
    cl_radio="unknown";
  } else if(data["clients"][client_id]["client_attrs"]["cl_radio"] == "5") {
    cl_radio="mobile";
  } else if(data["clients"][client_id]["client_attrs"]["cl_radio"] == "6") {
    cl_radio=".11n 2.4Ghz";
  } else if(data["clients"][client_id]["client_attrs"]["cl_radio"] == "7") {
    cl_radio=".11n 5Ghz";
  } else if(data["clients"][client_id]["client_attrs"]["cl_radio"] == "8") {
    cl_radio="ethernet";
  } else if(data["clients"][client_id]["client_attrs"]["cl_radio"] == "9") {
    cl_radio=".3";
  } else if(data["clients"][client_id]["client_attrs"]["cl_radio"] == "10") {
    cl_radio=".11ac";
  };


  client_div
   .append( $(LABEL).css({"display": "inline-block", "min-width": "1em"}) )
   .append( $(SPAN).text("Radio: "+cl_radio) )
   .append( $(SPAN).text(" @ ") )
   .append( $(SPAN).text(data["clients"][client_id]["client_attrs"]["cl_rate"]) )
  ;

  client_div
   .append( $(LABEL).css({"display": "inline-block", "min-width": "1em"}) )
   .append( $(SPAN).text("Int/VLAN: "+data["clients"][client_id]["client_attrs"]["cl_int"]) )
   .append( $(SPAN).text(" / ") )
   .append( $(SPAN).text(data["clients"][client_id]["client_attrs"]["cl_vlan"]) )
  ;

  let cl_pol_type="Unkn";

  if(data["clients"][client_id]["client_attrs"]["cl_pol_type"] == "0") {
    cl_pol_type="Dot1x";
  } else if(data["clients"][client_id]["client_attrs"]["cl_pol_type"] == "1") {
    cl_pol_type="WPA1";
  } else if(data["clients"][client_id]["client_attrs"]["cl_pol_type"] == "2") {
    cl_pol_type="WPA2";
  } else if(data["clients"][client_id]["client_attrs"]["cl_pol_type"] == "3") {
    cl_pol_type="WPA2vff";
  } else if(data["clients"][client_id]["client_attrs"]["cl_pol_type"] == "4") {
    cl_pol_type="n/a";
  } else if(data["clients"][client_id]["client_attrs"]["cl_pol_type"] == "5") {
    cl_pol_type="Unkn";
  };

  client_div
   .append( $(LABEL).css({"display": "inline-block", "min-width": "1em"}) )
   .append( $(SPAN).text("Sec: "+cl_pol_type).title("Policy type") )
  ;

  if(data["clients"][client_id]["client_attrs"]["cl_eap_type"] != "7") {
    let cl_eap_type="Unkn";
    if(data["clients"][client_id]["client_attrs"]["cl_eap_type"] == "0") {
      cl_eap_type="EAP-TLS";
    } else if(data["clients"][client_id]["client_attrs"]["cl_eap_type"] == "1") {
      cl_eap_type="EAP-TTLS";
    } else if(data["clients"][client_id]["client_attrs"]["cl_eap_type"] == "2") {
      cl_eap_type="EAP-PEAP";
    } else if(data["clients"][client_id]["client_attrs"]["cl_eap_type"] == "3") {
      cl_eap_type="EAP-LEAP";
    } else if(data["clients"][client_id]["client_attrs"]["cl_eap_type"] == "4") {
      cl_eap_type="EAP-SPEKE";
    } else if(data["clients"][client_id]["client_attrs"]["cl_eap_type"] == "5") {
      cl_eap_type="EAP-FAST";
    } else if(data["clients"][client_id]["client_attrs"]["cl_eap_type"] == "6") {
      cl_eap_type="n/a";
    };

    client_div
     .append( $(SPAN).text(" / ") )
     .append( $(SPAN).text(cl_eap_type).title("EAP type") )
    ;
  };

  client_div
   .append( $(BR) )
   .append( $(LABEL).text("Bytes In/Out: ") )
   .append( $(SPAN).text(GMK(data["clients"][client_id]["client_attrs"]["cl_bytes_rx"])) )
   .append( $(SPAN).text(" / ") )
   .append( $(SPAN).text(GMK(data["clients"][client_id]["client_attrs"]["cl_bytes_tx"])) )
   .append( !data["clients"][client_id]["rrd_file"]?$(LABEL):$(LABEL)
     .addClass("ui-icon").addClass("ui-icon-chart-line")
     .addClass("button").addClass("button_graph_bytes")
     .css({"margin-left": "0.5em"})
     .click(function() {
       let subject_div=$(this).closest(".client_div");
       let info_div=subject_div;
       let id=subject_div.data("id");
       let graph_class="graph_client_bytes";
       let local_key=graph_class+"_"+id;

       if(subject_div.find("."+graph_class).length > 0) {
         subject_div.find("."+graph_class).find(".close").trigger("click");
         return;
       };

       let graph_keys={
         "cl_bytes_rx": {
           "_order": 1,
           "label": "Байт/c от пользователя",
           "color": "blue",
           "borderColor": "blue",
           "borderWidth": 1,
           "backgroundColor": "blue",
           "yAxisID": "y",
         },
         "cl_bytes_tx": {
           "_order": 2,
           "label": "Байт/с к пользователю",
           "color": "cyan",
           "borderColor": "cyan",
           "borderWidth": 1,
           "backgroundColor": "cyan",
           "yAxisID": "y",
         },
       };

       let graph_options={
         "options": {
           "scales": {
             "y": {
               "type": "linear",
               "display": true,
               "position": "left",
             },
           },
         },
       };
               

       let graph_div=get_graph_div('Траффик, байты', graph_class, "client", id, graph_keys, graph_options, local_key)
        .css({"background-color": "white"})
        .appendTo(info_div)
       ;
       graph_div.find(".refresh").trigger("click");
       save_local(local_key, true);
     })
   )
   .append( $(LABEL).css({"display": "inline-block", "min-width": "1em"}) )
   .append( $(LABEL).text("Pkts In/Out: ") )
   .append( $(SPAN).text(GMK(data["clients"][client_id]["client_attrs"]["cl_pkts_rx"])) )
   .append( $(SPAN).text(" / ") )
   .append( $(SPAN).text(GMK(data["clients"][client_id]["client_attrs"]["cl_pkts_tx"])) )
   .append( !data["clients"][client_id]["rrd_file"]?$(LABEL):$(LABEL)
     .addClass("ui-icon").addClass("ui-icon-chart-line")
     .addClass("button").addClass("button_graph_pkts")
     .css({"margin-left": "0.5em"})
     .click(function() {
       let subject_div=$(this).closest(".client_div");
       let info_div=subject_div;
       let id=subject_div.data("id");
       let graph_class="graph_client_pkts";
       let local_key=graph_class+"_"+id;

       if(subject_div.find("."+graph_class).length > 0) {
         subject_div.find("."+graph_class).find(".close").trigger("click");
         return;
       };

       let graph_keys={
         "cl_pkts_rx": {
           "_order": 1,
           "label": "Пакет/c от пользователя",
           "color": "blue",
           "borderColor": "blue",
           "borderWidth": 1,
           "backgroundColor": "blue",
           "yAxisID": "y",
         },
         "cl_pkts_tx": {
           "_order": 2,
           "label": "Пакет/с к пользователю",
           "color": "cyan",
           "borderColor": "cyan",
           "borderWidth": 1,
           "backgroundColor": "cyan",
           "yAxisID": "y",
         },
       };

       let graph_options={
         "options": {
           "scales": {
             "y": {
               "type": "linear",
               "display": true,
               "position": "left",
             },
           },
         },
       };
               

       let graph_div=get_graph_div('Траффик, пакеты', graph_class, "client", id, graph_keys, graph_options, local_key)
        .css({"background-color": "white"})
        .appendTo(info_div)
       ;
       graph_div.find(".refresh").trigger("click");
       save_local(local_key, true);
     })
   )
   .append( $(LABEL).css({"display": "inline-block", "min-width": "1em"}) )
   .append( $(LABEL).text("Err: Pol/Dup/Retr: ") )
   .append( $(SPAN).text(GMK(data["clients"][client_id]["client_attrs"]["cl_pol_errors"])).title("Policy errors") )
   .append( $(SPAN).text(" / ") )
   .append( $(SPAN).text(GMK(data["clients"][client_id]["client_attrs"]["cl_dup_pkts"])).title("Duplicate packets") )
   .append( $(SPAN).text(" / ") )
   .append( $(SPAN).text(GMK(data["clients"][client_id]["client_attrs"]["cl_data_retries"])).title("Data retries") )
   .append( !data["clients"][client_id]["rrd_file"]?$(LABEL):$(LABEL)
     .addClass("ui-icon").addClass("ui-icon-chart-line")
     .addClass("button").addClass("button_graph_errors")
     .css({"margin-left": "0.5em"})
     .click(function() {
       let subject_div=$(this).closest(".client_div");
       let info_div=subject_div;
       let id=subject_div.data("id");
       let graph_class="graph_client_errors";
       let local_key=graph_class+"_"+id;

       if(subject_div.find("."+graph_class).length > 0) {
         subject_div.find("."+graph_class).find(".close").trigger("click");
         return;
       };

       let graph_keys={
         "cl_data_retries": {
           "_order": 1,
           "label": "Повторы",
           "color": "brown",
           "borderColor": "brown",
           "borderWidth": 1,
           "backgroundColor": "brown",
           "yAxisID": "y",
         },
         "cl_dup_pkts": {
           "_order": 2,
           "label": "Дубликаты",
           "color": "red",
           "borderColor": "red",
           "borderWidth": 1,
           "backgroundColor": "red",
           "yAxisID": "y",
         },
       };

       let graph_options={
         "options": {
           "scales": {
             "y": {
               "type": "linear",
               "display": true,
               "position": "left",
             },
           },
         },
       };
               

       let graph_div=get_graph_div('Счетчики ошибок', graph_class, "client", id, graph_keys, graph_options, local_key)
        .css({"background-color": "white"})
        .appendTo(info_div)
       ;
       graph_div.find(".refresh").trigger("click");
       save_local(local_key, true);
     })
   )
  ;
  client_div
   .data("search", client_search_array)
  ;

  if(get_local("graph_client_signal_"+client_id, false)) {
    client_div.find(".button_graph_signal").trigger("click");
  };

  if(get_local("graph_client_bytes_"+client_id, false)) {
    client_div.find(".button_graph_bytes").trigger("click");
  };

  if(get_local("graph_client_pkts_"+client_id, false)) {
    client_div.find(".button_graph_pkts").trigger("click");
  };

  if(get_local("graph_client_errors_"+client_id, false)) {
    client_div.find(".button_graph_errors").trigger("click");
  };

  return client_div;
};

function refresh_page() {
  run_query({"action": "get_scan_data"}, function(res) {

    data=res["ok"];
    structure={};
    apsByMac={};

    global_AP_models={};

    //WLC selector
    let wlcs=$(FIELDSET).prop("id", "wlcs_list_fs");
    wlcs.append( $(LEGEND).text("WLC:") )
    for(let wlc_ip in data["wlcs"]) {
      let l = $(LABEL).prop("for", "wlc_sel_"+wlc_ip)
       .text( data["wlcs"][wlc_ip]["attrs"]["host_name"] )
       .title( data["wlcs"][wlc_ip]["attrs"]["model"]+" "+wlc_ip+" "+data["wlcs"][wlc_ip]["site"] )
       .append( data["wlcs"][wlc_ip]["site"] != 'nosite'? $(LABEL) :
         $(LABEL)
          .addClass("nosite")
          .addClass("ui-icon")
          .addClass("ui-icon-notice")
          .addClass("ui-state-error")
       )
      ;
      if(data["wlcs"][wlc_ip]["status"] != "ok") {
        l
         .append( $(LABEL).addClass("ui-icon").addClass("ui-icon-alert")
           .title( data["wlcs"][wlc_ip]["error"] )
         )
        ;
      };
      l.appendTo(wlcs)
      $(INPUT).prop("id", "wlc_sel_"+wlc_ip).prop("type", "checkbox")
       .prop("checked", !get_local("wlc_unchecked_"+wlc_ip, false))
       .data("id", wlc_ip)
       .on("change", function() {
          let _id = $(this).data("id");
          save_local("wlc_unchecked_"+ _id, ! $(this).is(":checked"));
          apply_filters($("#workarea"));
       })
       .appendTo(wlcs)
      ;
    };
    wlcs.find("input[type='checkbox']").checkboxradio();

    $("#wlcs_list").empty().append(wlcs);

    //build data structure

    let clients_keys=keys(data["clients"]);
    clients_keys.sort(function(a,b) {
      return data["clients"][a]["client_mac"] > data["clients"][b]["client_mac"]?1:(data["clients"][a]["client_mac"] < data["clients"][b]["client_mac"]?-1:0);
    });

    for(let ci in clients_keys) {
      let client_key=clients_keys[ci];

      let wlc_ip=data["clients"][client_key]["client_wlc"];
      let ap_id=data["clients"][client_key]["client_attrs"]["cl_ap_mac"]+"@"+wlc_ip;


      if(typeof(structure[wlc_ip]) === 'undefined') {
        structure[wlc_ip]={ "ssids": {}, "idle_aps": []};
      };

      let ssid_id=data["clients"][client_key]["client_attrs"]["cl_ssid"];

      if(typeof(structure[wlc_ip]["ssids"][ssid_id]) === 'undefined') {
        structure[wlc_ip]["ssids"][ssid_id]={};
      };

      if(typeof(structure[wlc_ip]["ssids"][ssid_id][ap_id]) === 'undefined') {
        structure[wlc_ip]["ssids"][ssid_id][ap_id] = [];

        if(typeof(data["aps"][ap_id]) !== 'undefined') {
          if(typeof(data["aps"][ap_id]["_mark"]) === 'undefined') {
            data["aps"][ap_id]["_mark"] = 1
          } else {
            data["aps"][ap_id]["_mark"] ++
          };
        };
      };

      structure[wlc_ip]["ssids"][ssid_id][ap_id].push(client_key);
    };

    for(let ap_id in data["aps"]) {
      apsByMac[ data["aps"][ap_id]["ap_mac"] ] = ap_id;

      if(typeof(global_AP_models[ data["aps"][ap_id]["ap_attrs"]["ap_model"].trim() ]) === 'undefined') {
        global_AP_models[ data["aps"][ap_id]["ap_attrs"]["ap_model"].trim() ] = 1;
      } else {
        global_AP_models[ data["aps"][ap_id]["ap_attrs"]["ap_model"].trim() ] ++;
      };

      if(typeof(data["aps"][ap_id]["_mark"]) === 'undefined') {
        let wlc_ip=data["aps"][ap_id]["ap_wlc"];
        if(typeof(structure[wlc_ip]) === 'undefined') {
          structure[wlc_ip]={ "ssids": {}, "idle_aps": []};
        };
        structure[wlc_ip]["idle_aps"].push(ap_id);
      };
    };

    for(let wlc_ip in data["wlcs"]) {
      if(typeof(structure[wlc_ip]) === 'undefined') {
        structure[wlc_ip]={ "ssids": {}, "idle_aps": []};
      };
      for(let ssid_id in data["wlcs"][wlc_ip]["ssids"]) {
        if(typeof(structure[wlc_ip]["ssids"][ssid_id]) === 'undefined') {
          structure[wlc_ip]["ssids"][ssid_id]={};
        };
      };
    };


    //construct visible page

    let page=$(DIV).addClass("page")
      .addClass("wsp")
      .css({"display": "inline-block"})
    ;

    let wlc_keys=keys(structure);
    wlc_keys.sort(function(a, b) {
      return a > b?1:(a < b?-1:0);
    });

    for(let w in wlc_keys) {
      let wlc_ip=wlc_keys[w];

      if(typeof(data["wlcs"][wlc_ip]) === 'undefined') {
error_at();
        data["wlcs"][wlc_ip] = { "status": "unknown", "error": "No such WLC in data!", "last_ok": 0, "last_seen": 0, "ssids": {}, "rrd_file": false,
          "stats": { "aps": 0, "auth_clients": 0, "clients": 0, "delay": 0, "duration": 0 },
          "attrs": { "host_name": "UNKNOWN", "model": "UNKNOWN", "serial": "UNKNOWN", "software": "n/d", "sys_object_id": "" },
        };
      };

      let wlc_head_div=$(DIV).addClass("wlc_head_div");
      let wlc_ssids_div=$(DIV).addClass("wlc_ssids_div");
      let wlc_idles_div=$(DIV).addClass("wlc_idles_div");

      let wlc_div = $(DIV).addClass("wlc_div")
       .addClass("search_container")
       .data("id", wlc_ip)
       .append( wlc_head_div ) // head
       .append( wlc_ssids_div ) // SSIDs
       .append( wlc_idles_div ) // idle APs
       .appendTo( page )
      ;

      wlc_head_div
       .addClass("info_container")
       //.append( $(LABEL).addClass("ui-icon").addClass("ui-icon-caret-2-s").addClass("button")
       .append( $(LABEL).addClass("ui-icon").addClass("ui-icon-info").addClass("button").addClass("info_button")
         .title("Show info. Ctrl-click closes all")
         .click(function(e) {
           if(e.ctrlKey) {
             $(".wlc_head_div").find(".info_div").remove();
             del_local(/^wlc_info_/);
             del_local(/^graph_wlc_/);
             return;
           };
           let ic=$(this).closest(".info_container");
           if(ic.length == 0) return;
           let id=$(this).closest(".wlc_div").data("id");
           let local_key="wlc_info_"+id;
           let idiv=ic.find(".info_div");
           if(idiv.length > 0) {
             del_local(local_key);
             del_local(new RegExp('^graph_wlc_times_'+RegExp.escape(id)));
             del_local(new RegExp('^graph_wlc_users_'+RegExp.escape(id)));
             idiv.remove();
             return;
           };

           idiv=$(DIV)
            .addClass("info_div")
           ;

           if(data["wlcs"][id]["status"] != "ok") {
             idiv
              .append( $(DIV)
                .append( $(LABEL).text("Last seen: "+from_unix_time(data["wlcs"][id]["last_seen"]) ) )
                .append( $(LABEL).addClass("min2em") )
                .append( $(LABEL).text("Last Ok: "+from_unix_time(data["wlcs"][id]["last_ok"]) ) )
              )
              .append( $(DIV)
                .append( $(LABEL).text("Error: ") )
                .append( $(SPAN).text(data["wlcs"][id]["error"]) )
              )
             ;
           };

           idiv
            .append( $(SPAN).text("S/W: "+data["wlcs"][id]["attrs"]["software"]) )
            .append( $(LABEL).addClass("min1em") )
            .append( $(SPAN).text("S/N: "+data["wlcs"][id]["attrs"]["serial"]) )
            .append( $(LABEL).addClass("min1em") )
            .append( $(SPAN).text("Site: "+data["wlcs"][id]["site"]) )
            .append( $(LABEL).addClass("min1em") )
            .append( $(SPAN).text("Net: "+data["wlcs"][id]["netname"]) )
            .append( $(BR) )
           ;

           idiv
            .append( $(SPAN).text("APs: "+data["wlcs"][id]["stats"]["aps"]) )
            .append( $(LABEL).addClass("min1em") )
            .append( $(SPAN).text("Auth users: "+data["wlcs"][id]["stats"]["auth_clients"]) )
            .append( $(SPAN).text(" of "+data["wlcs"][id]["stats"]["clients"]) )
            .append( $(SPAN).text(" total.") )
            .append( $(LABEL).addClass("min1em") )
            .append( !data["wlcs"][id]["rrd_file"]?$(LABEL):$(LABEL)
              .addClass("ui-icon").addClass("ui-icon-chart-line")
              .addClass("button").addClass("button_graph_wlc_users")
              .click(function() {
                let subject_div=$(this).closest(".wlc_div");
                let info_div=subject_div.find(".wlc_head_div").find(".info_div");
                let id=subject_div.data("id");
                let graph_class="graph_wlc_users";
                let local_key=graph_class+"_"+id;

                if(subject_div.find("."+graph_class).length > 0) {
                  subject_div.find("."+graph_class).find(".close").trigger("click");
                  return;
                };

                let graph_keys={
                  "clients": {
                    "_order": 1,
                    "label": "Пользователей",
                    "color": "blue",
                    "borderColor": "blue",
                    "borderWidth": 1,
                    "backgroundColor": "blue",
                    "yAxisID": "y",
                  },
                  "auth_clients": {
                    "_order": 2,
                    "label": "Авторизованых",
                    "color": "cyan",
                    "borderColor": "cyan",
                    "borderWidth": 1,
                    "backgroundColor": "cyan",
                    "yAxisID": "y",
                  },
                };

                let graph_options={
                  "options": {
                    "scales": {
                      "y": {
                        "type": "linear",
                        "display": true,
                        "position": "left",
                      },
                    },
                  },
                };
                        

                let graph_div=get_graph_div('Пользователи', graph_class, "wlc", id, graph_keys, graph_options, local_key)
                 .css({"background-color": "white"})
                 .appendTo(info_div)
                ;
                graph_div.find(".refresh").trigger("click");
                save_local(local_key, true);
              })
            )
            .append( $(LABEL).addClass("min1em") )
            .append( $(SPAN).text("Delay: "+data["wlcs"][id]["stats"]["delay"]+" ms") )
            .append( $(LABEL).addClass("min1em") )
            .append( $(SPAN).text("Duration: "+data["wlcs"][id]["stats"]["duration"]+" ms") )
            .append( $(LABEL).addClass("min1em") )
            .append( !data["wlcs"][id]["rrd_file"]?$(LABEL):$(LABEL)
              .addClass("ui-icon").addClass("ui-icon-chart-line")
              .addClass("button").addClass("button_graph_wlc_times")
              .click(function() {
                let subject_div=$(this).closest(".wlc_div");
                let info_div=subject_div.find(".wlc_head_div").find(".info_div");
                let id=subject_div.data("id");
                let graph_class="graph_wlc_times";
                let local_key=graph_class+"_"+id;

                if(subject_div.find("."+graph_class).length > 0) {
                  subject_div.find("."+graph_class).find(".close").trigger("click");
                  return;
                };

                let graph_keys={
                  "delay": {
                    "_order": 1,
                    "label": "Задержка, мс",
                    "color": "blue",
                    "borderColor": "blue",
                    "borderWidth": 1,
                    "backgroundColor": "blue",
                    "yAxisID": "y",
                  },
                  "duration": {
                    "_order": 2,
                    "label": "Полное время запроса, мс",
                    "color": "cyan",
                    "borderColor": "cyan",
                    "borderWidth": 1,
                    "backgroundColor": "cyan",
                    "yAxisID": "y1",
                  },
                };

                let graph_options={
                  "options": {
                    "scales": {
                      "y": {
                        "type": "linear",
                        "display": true,
                        "position": "left",
                      },
                      "y1": {
                        "type": "linear",
                        "display": true,
                        "position": "right",
                        "grid": { "drawOnChartArea": false },
                        "beginAtZero": true
                      },
                    },
                  },
                };
                        

                let graph_div=get_graph_div('Временные характеристики', graph_class, "wlc", id, graph_keys, graph_options, local_key)
                 .css({"background-color": "white"})
                 .appendTo(info_div)
                ;
                graph_div.find(".refresh").trigger("click");
                save_local(local_key, true);
              })
            )


           idiv.appendTo(ic);
           save_local(local_key, true);
         })
       )
      ;

      wlc_head_div
       .append( $(LABEL).text(wlc_ip).css({"margin-right": "1em", "margin-left": "1em", "display": "inline-block", "min-width": "8em"})
         .title( "Site: "+data["wlcs"][wlc_ip]["site"]
           +"\nNet: "+data["wlcs"][wlc_ip]["netname"]
         )
         .append( data["wlcs"][wlc_ip]["site"] != 'nosite'? $(LABEL) :
           $(LABEL)
            .addClass("nosite")
            .addClass("ui-icon")
            .addClass("ui-icon-notice")
            .addClass("ui-state-error")
         )
       )
       .append( $(LABEL).text(data["wlcs"][wlc_ip]["attrs"]["host_name"]).css({"margin-right": "2em", "margin-left": "1em"})
         .title( "Software: "+data["wlcs"][wlc_ip]["attrs"]["software"] )
       )
       .append( $(LABEL).text(data["wlcs"][wlc_ip]["attrs"]["model"]).css({"margin-right": "2em"})
         .title( "Serial: "+data["wlcs"][wlc_ip]["attrs"]["serial"] )
       )
      ;

      if(data["wlcs"][wlc_ip]["status"] != "ok") {
        wlc_head_div
         .append( $(LABEL).addClass("ui-icon").addClass("ui-icon-alert").addClass("ui-state-error")
           .title(data["wlcs"][wlc_ip]["error"])
         )
        ;
        wlc_div.css({"background-color": "tomato"})
      } else {
        wlc_head_div.css({"background-color": "powderblue"})
      };

      if(get_local("wlc_info_"+wlc_ip, false)) {
        wlc_head_div.find(".info_button").trigger("click");
        if(get_local("graph_wlc_times_"+wlc_ip, false)) {
          wlc_head_div.find(".button_graph_wlc_times").trigger("click");
        };

        if(get_local("graph_wlc_users_"+wlc_ip, false)) {
          wlc_head_div.find(".button_graph_wlc_users").trigger("click");
        };
      };

      let ssid_keys = keys(structure[wlc_ip]["ssids"]);
      ssid_keys.sort(function(a, b) {
        return data["wlcs"][wlc_ip]["ssids"][ a ].localeCompare( data["wlcs"][wlc_ip]["ssids"][ b ]);
      });

      //wlc_ssids_div.append( $(DIV).text(ssid_keys.join(",")) );

      for( let si in ssid_keys) {
        let ssid_id=ssid_keys[si];

        //wlc_ssids_div.append( $(DIV).text(si+" : "+ssid_id) );

        let aps_keys = keys(structure[wlc_ip]["ssids"][ssid_id]);
        aps_keys.sort(function(a, b) {
          return a.localeCompare(b);
        });

        if(aps_keys.length > 0) {
          let ssid_name=data["wlcs"][wlc_ip]["ssids"][ ssid_id ];
          let ssid_head=$(DIV).addClass("ssid_head_div")
           .append( $(LABEL).text(ssid_name) )
           .append( $(SPAN).addClass("head_buttons_spacer") )
           .append( $(LABEL).addClass("to_filter_head_button").addClass("ui-icon").addClass("ui-icon-zoomequal")
             .addClass("button")
             .title("Добавить к фильтру")
             .click(function() {
               let name=$(this).closest(".ssid_div").data("name");

               let filter=$("#ssid_filter").val()+"|"+name;
               $("#ssid_filter").val(filter).trigger("change");
             })
           )
          ;
          let aps_div=$(DIV).addClass("aps_div")
          ;

          let ssid_div=$(DIV).addClass("ssid_div")
           .data("id", ssid_id)
           .data("name", ssid_name)
           .data("search", ssid_name)
           .append( ssid_head )
           .append( aps_div )
           .appendTo( wlc_ssids_div )
          ;

          for(let ai in aps_keys) {
            let ap_id=aps_keys[ai];

            if(typeof(data["aps"][ap_id]) === 'undefined') {
              data["aps"][ap_id]={ "status": "UNKNOWN", "ap_mac": "UNKNOWN",
                "ap_attrs": {
                  "ap_ip": "0.0.0.0",
                  "ap_location": "UNKNOWN",
                  "ap_mac": "UNKNOWN",
                  "ap_model": "UNKNOWN",
                  "ap_name": "UNKNOWN",
                  "ap_num_slots": "0",
                  "ap_serial": "UNKNOWN",
                  "ap_site": "UNKNOWN",
                  "ap_uptime": "0"
                },
                "ap_radio_attrs": {},
                "ap_cdp_neighbours": {},
                "last_ok": 0,
                "rrd_file": false
              };
            };


            let ap_div=get_ap_div(ap_id)
             .appendTo( aps_div )
            ;

            let ap_clients_div=$(DIV).addClass("ap_clients_div")
             .appendTo( ap_div )
            ;

            for(let ci in structure[wlc_ip]["ssids"][ssid_id][ap_id]) {
              let client_id = structure[wlc_ip]["ssids"][ssid_id][ap_id][ci];

              let client_div=get_client_div(client_id);
              client_div.appendTo( ap_clients_div );
            };

          };
        };

      };

      if(true) {
        structure[wlc_ip]["idle_aps"].sort(function(a, b) {
          return a.localeCompare(b);
        });

        if(structure[wlc_ip]["idle_aps"].length > 0) {
          let idle_div=$(DIV).addClass("idle_div")
           .appendTo( wlc_idles_div )
          ;
          let idle_head_div=$(DIV).addClass("idle_head_div")
           .append( $(LABEL).text("Точки без клиентов") )
           .appendTo( idle_div )
          ;

          let idle_aps_div=$(DIV).addClass("idle_aps_div")
           .appendTo( idle_div )
          ;
          for(let ai in structure[wlc_ip]["idle_aps"]) {
            let ap_id=structure[wlc_ip]["idle_aps"][ai];

            if(typeof(data["aps"][ap_id]) === 'undefined') {
              data["aps"][ap_id]={ "status": "UNKNOWN", "ap_mac": "UNKNOWN",
                "ap_attrs": {
                  "ap_ip": "0.0.0.0",
                  "ap_location": "UNKNOWN",
                  "ap_mac": "UNKNOWN",
                  "ap_model": "UNKNOWN",
                  "ap_name": "UNKNOWN",
                  "ap_num_slots": "0",
                  "ap_serial": "UNKNOWN",
                  "ap_site": "UNKNOWN",
                  "ap_uptime": "0"
                },
                "ap_radio_attrs": {},
                "ap_cdp_neighbours": {},
                "last_ok": 0,
                "rrd_file": false
              };
            };

            if(typeof(data["aps"][ap_id]["ap_attrs"]["ap_site"]) === 'undefined') {
              data["aps"][ap_id]["ap_attrs"]["ap_site"] = 'undefined';
            };

            let ap_div=get_ap_div(ap_id)
             .appendTo( idle_aps_div )
            ;
          };

        };
      };
    };

    apply_filters( page );

    $("#workarea").empty().append( page );

    $("#autoupdate").trigger("change");

    //$("#debug_win").text(jstr(data));

  });
};

function apply_filters( page ) {
  let ap_filter=get_local("ap_filter", "");
  let user_filter=get_local("user_filter", "");
  let ssid_filter=get_local("ssid_filter", "");

  let ap_filters=ap_filter.split("|");
  for(let i=(ap_filters.length - 1); i >= 0; i --) {
    ap_filters[i] = ap_filters[i].trim().toLowerCase();
    ap_filters[i] = pretty_MAC(ap_filters[i], "");
    if(ap_filters[i] == "") {
      ap_filters.splice(i, 1);
    };
  };

  let user_filters=user_filter.split("|");
  for(let i=(user_filters.length - 1); i >= 0; i --) {
    user_filters[i] = user_filters[i].trim().toLowerCase();
    if(user_filters[i] == "") {
      user_filters.splice(i, 1);
    };
  };

  let ssid_filters=ssid_filter.split("|");
  for(let i=(ssid_filters.length - 1); i >= 0; i --) {
    ssid_filters[i] = ssid_filters[i].trim().toLowerCase();
    if(ssid_filters[i] == "") {
      ssid_filters.splice(i, 1);
    };
  };

  page.find(".wlc_div").each(function() {
    let wlc_ip=$(this).data("id");
    if(get_local("wlc_unchecked_"+wlc_ip, false)) {
      $(this).hide();
    } else {
      let ssid_matches = 0;
      let idle_matches = 0;

      $(this).find(".ssid_div").each(function() {
        let ssid_matched=false;
        if(ssid_filters.length > 0) {
          let search_string=$(this).data("search").toLowerCase();
          for(let si in ssid_filters) {
            if(ssid_filters[si].localeCompare(search_string) === 0) {
              ssid_matched=true;
              break;
            };
          };
        } else {
          ssid_matched=true;
        };

        if(!ssid_matched) {
          $(this).hide();
        } else {
          let aps_matches = 0;
          $(this).find(".ap_div").each(function() {
            let ap_matched=false;
            if(ap_filters.length > 0) {
              let search=$(this).data("search");
              for(let ap_search_i in search) {
                let sstr=search[ap_search_i];
                for(let ap_filter_i in ap_filters) {
                  let fstr=ap_filters[ap_filter_i];
                  if(sstr.includes(fstr)) {
                    ap_matched=true;
                    break;
                  };
                };
                if(ap_matched) break;
              };
            } else {
              ap_matched=true;
            };

            if(!ap_matched) {
              $(this).hide();
            } else {
              let clients_matches = 0;
              $(this).find(".client_div").each(function() {
                let client_matched=false;
                let client_search=$(this).data("search");

                if(user_filters.length > 0) {
                  for(let user_filter_i in user_filters) {
                    for(let client_search_i in client_search) {
                      if(client_search[client_search_i].includes(user_filters[user_filter_i])) {
                        client_matched=true;
                        break;
                      };
                    };
                    if(client_matched) break;
                  };
                } else {
                  client_matched=true;
                };

                if(!client_matched) {
                  $(this).hide();
                } else {
                  $(this).show();
                  clients_matches ++;
                };
              });

              if(clients_matches > 0) {
                $(this).show();
                aps_matches++;
              } else {
                $(this).hide();
              };
            };
          });
          if(aps_matches > 0) {
            $(this).show();
            ssid_matches++;
          } else {
            $(this).hide();
          };
        };
      });
      if(ssid_filters.length == 0) {
        $(this).find(".wlc_idles_div").find(".ap_div").each(function() {
          let ap_matched=false;
          if(user_filters.length == 0) {
            if(ap_filters.length > 0) {
              let search=$(this).data("search");
              for(let ap_search_i in search) {
                let sstr=search[ap_search_i];
                for(let ap_filter_i in ap_filters) {
                  let fstr=ap_filters[ap_filter_i];
                  if(sstr.includes(fstr)) {
                    ap_matched=true;
                    break;
                  };
                };
                if(ap_matched) break;
              };
            } else {
              ap_matched=true;
            };
          };
  
          if(!ap_matched) {
            $(this).hide();
          } else {
            $(this).show();
            idle_matches++;
            };
        });
      };

      if(ssid_matches == 0 && idle_matches == 0) {
        $(this).hide();
      } else {
        $(this).show();
        if(idle_matches == 0 || ssid_filters.length > 0) {
          $(this).find(".wlc_idles_div").hide();
        } else {
          $(this).find(".wlc_idles_div").show();
        };
      };
    };
  });
};
