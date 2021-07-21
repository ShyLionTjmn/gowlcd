'use strict';
//import { ru } from 'date-fns/locale';

var user_self_id="none";
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

$( document ).ready(function() {

  $("BODY")
   .append( $(DIV).addClass("debug")
     .css({"position": "absolute", "right": "3em", "width": "30em", "top": "3em", "bottom": "3em", "overflow": "auto", "white-space": "pre"})
   )
   .append( $(LABEL).text("G").addClass("button")
     .addClass("showgraph")
     .click(function() {
       let subject_div=$("BODY");
       let id="10.96.39.2";
       let graph_class="graph_wlc_times";

       if(subject_div.find("."+graph_class).length > 0) {
         subject_div.find("."+graph_class).remove();
         return;
       };

       let graph_keys={
         "delay": {
           "label": "Задержка",
           "color": "blue",
           "borderColor": "blue",
           "borderWidth": 1,
           "backgroundColor": "blue",
         },
         "duration": {
           "label": "Полное время запроса",
           "color": "cyan",
           "borderColor": "cyan",
           "borderWidth": 1,
           "backgroundColor": "cyan",
         },
       };
       let graph_div=get_graph_div('Временные характеристики', graph_class, "wlc", id, graph_keys, undefined, "test")
        .appendTo($(".info_div"))
       ;
       graph_div.find(".refresh").trigger("click");
     })
   )
   .append( $(DIV).addClass("info_div") )
  ;
  $(".showgraph").trigger("click");
});
