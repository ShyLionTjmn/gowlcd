'use strict';

const tooltipPlugin = Chart.registry.getPlugin('tooltip');

const GRAPH_MAX_RANGE=300*24*60*60;
const GRAPH_MIN_RANGE=300;

tooltipPlugin.positioners.bottom = function(items) {
  const pos = tooltipPlugin.positioners.average(items);

  // Happens when nothing is found
  if (pos === false) {
    return false;
  }

  const chart = this._chart;

  return {
    x: pos.x,
    y: chart.chartArea.top,
  };
};

var graph_zoom_timer;
var graph_drag_timer;

function get_graph_div(title, graph_class, obj, id, graph_keys, graph_options, local_key) {

  let size_x=get_local(local_key+"_size_x", 800);
  let size_y=get_local(local_key+"_size_y", 200);

  let ret=$(DIV)
   //.css({"display": "inline-block"})
   .addClass("graph_div")
   .addClass(graph_class)
   .data("obj", obj)
   .data("id", id)
   .data("keys", graph_keys)
   .data("local_key", local_key)
   .append( $(DIV).css({"display": "inline-block"})
     .append( $(DIV).text(title) )
     .append( $(DIV)
       .append( $(LABEL).text("Обновить").addClass("button")
         .addClass("refresh")
         .click(function() {
           let gd=$(this).closest(".graph_div");
           let debug=$(".debug");
           let chart=gd.data("chart");
           let local_key=gd.data("local_key");

           let end=gd.data("end");
           let range=gd.data("range");
           if(typeof(end) === 'undefined') {
             end=get_local(local_key+"_end", "now");
             range=Math.round(get_local(local_key+"_range", 3600));
             gd.data("end", end);
             gd.data("range", range);
           };

           save_local(local_key+"_end", end);
           save_local(local_key+"_range", range);

           let stop=end;
           if(stop === 'now') {
             stop=unix_timestamp();
           };

           let start=stop-range;

           let obj=gd.data("obj");
           let id=gd.data("id");
           let data_keys=gd.data("keys");
           let gk=keys(data_keys);

           gk.sort(function(a,b) {
             if(typeof(data_keys[a]['_order']) === 'undefined' || typeof(data_keys[b]['_order']) === 'undefined') {
               return String(a).localeCompare(b);
             };
             return data_keys[a]['_order'] - data_keys[b]['_order'];
           });
           setTimeout(function() {
             run_query({"action": "graph", "object": obj, "id": id, "keys": gk, "start": start.toString(), "end": stop.toString()}, function(qres) {
               let chart_data = qres["ok"];

               for(let i in chart_data.datasets) {
                 if(typeof(data_keys[chart_data.datasets[i]['label']]) !== 'undefined') {
                   let field = chart_data.datasets[i]['label'];
                   for(let opt in data_keys[field]) {
                     if(opt != "_order") {
                       chart_data.datasets[i][opt] = data_keys[field][opt];
                     };
                   };
                 };
               };

               chart.data = chart_data;
               chart.update('none');

               gd.data("real_end", chart_data["_end"]);
               gd.data("real_start", chart_data["_start"]);

               $(".debug").text(jstr(chart_data));

               //let scale_lefts=chart.scales.x.left;
               //let scale_width=Number(chart.scales.x.width);

               //let handle_width=Number(gd.find(".timebox").find(".handle").width())+2; //+ border

               //gd.find(".timebox").find(".handle").css({"left": Number(scale_width/2 - handle_width/2)+"px"});

               gd.find(".timebox")
                //.css({"top": chart.scales.x.top-1+"px", "left": chart.scales.x.left-1+"px", "width": chart.scales.x.width+"px", "height": chart.scales.x.height+"px"})
                .data("start", chart_data["_start"])
                .data("end", chart_data["_end"])
               ;
               gd.find(".start").text(from_unix_time(chart_data["_start"]));
               if(end === "now") {
                 gd.find(".end").text(from_unix_time(chart_data["_end"])+" NOW");
               } else {
                 gd.find(".end").text(from_unix_time(chart_data["_end"]));
               };
             });
           }, 0);
         })
       )
       .append( $(LABEL).text("X").addClass("button")
         .title("Close this graph. Ctrl-click closes all!")
         .css({"float": "right"})
         .addClass("close")
         .click(function(e) {
           if(e.ctrlKey) {
             $(".graph_div").remove();
             del_local(/^graph_/);
           };
           let gd=$(this).closest(".graph_div");
           let local_key=gd.data("local_key");
           del_local(local_key);
           del_local(local_key+"_end");
           del_local(local_key+"_range");
           del_local(local_key+"_size_x");
           del_local(local_key+"_size_y");
           gd.remove();
         })
       )
     )
     .append( $(DIV)
       .css({"width": size_x+"px", "height": size_y+"px", "position": "relative"})
       .css({"border": "1px solid black"})
       .append( $(DIV).addClass("timebox")
         .css("z-index", 20)
         .css({"position": "absolute", "_border": "1px solid red"})
         .append( $(LABEL).text("<  >").css({"font-size": "10px", "text-align": "center"}).addClass("handle")
           .css({"display": "inline-block", "position": "absolute", "width": "20px", "height": "10px", "border": "1px solid #44444480", "background-color": "#DDDDDD80"})
           .draggable({
             "containment": "parent",
             "axis": "x",
             "start": function() {
               let tb=$(this).closest(".timebox");
               tb.find(".timedisplay").show();
             },
             "stop": function() {
               let tb=$(this).closest(".timebox");
               tb.find(".timedisplay").hide();
               let gd=$(this).closest(".graph_div");
               gd.find(".refresh").trigger("click");
             },
             "drag": function() {
               let tb=$(this).closest(".timebox");
               let td=tb.find(".timedisplay");
               let xpos=$(this).position()['left'];

               let cur_start=Number(tb.data("start"));
               let cur_end=Number(tb.data("end"));
               let range=cur_end-cur_start;

               let scale_factor=8;

               let handle_end= Math.round(cur_end + range*(xpos/( (tb.innerWidth() - $(this).outerWidth())/2) - 1) * scale_factor);

               let now=unix_timestamp();
               let end_is_now = handle_end > now;

               if(end_is_now) handle_end=now;

               let handle_start= handle_end - range;

               let helper_text = from_unix_time(handle_start) + " - " + from_unix_time(handle_end);

               let gd=$(this).closest(".graph_div");

               if(end_is_now) {
                 helper_text += " NOW";
                 gd.data("end", "now");
               } else {
                 gd.data("end", handle_end);
               };

               td.text(helper_text);
             }
           })
         )
         .append( $(DIV).addClass("timedisplay")
           .css({"margin": "auto", "margin-top": "1em", "width": "22em",
                 "border": "1px solid #44444480", "background-color": "rgba(200,200,200,0.9)",
                 "white-space": "pre", "font-size": "smaller",
                 "text-align": "center",
                 "display": "none"
           })
           .text("")
         )
       )
       .append( $(CANVAS)
         .css("z-index", 10)
         .on("wheel", function(e) {
           e.preventDefault();
           if(e.originalEvent.deltaY !== 0) {
             let x = e.pageX - $(this).offset().left;
             let y = e.pageY - $(this).offset().top;
             let gd=$(this).closest(".graph_div");

             let chart=gd.data("chart");
             let chart_x=chart.chartArea.left;
             let chart_width=chart.chartArea.width;
             let chart_y=chart.chartArea.top;
             let chart_height=chart.chartArea.height;

             if( x >= chart_x && x <= (chart_x+chart_width) &&
                 y >= chart_y && y <= (chart_y+chart_height)
             ) {

               let start=gd.data("real_start");
               if(typeof(start) === 'undefined') return;

               let range=gd.data("range");

               let wheel_time = Math.round( ((x - chart_x) / chart_width) * range ) + start;

               if(e.originalEvent.deltaY < 0) {
                 //wheel up
                 range = range / 2;
                 if(range < GRAPH_MIN_RANGE) range = GRAPH_MIN_RANGE;
               } else {
                 //wheel down
                 range = range * 2;
                 if(range > GRAPH_MAX_RANGE) range = GRAPH_MAX_RANGE;
               };

               let new_end = Math.round(wheel_time + range/2);
               let now=unix_timestamp()

               let display_end=new_end;

               let end_is_now= new_end > now;

               if(end_is_now) {
                 new_end = 'now';
                 display_end=now;
               };

               let text=from_unix_time(display_end-range)+" - "+from_unix_time(display_end);
               if(end_is_now) text += " NOW";

               gd.data("range", Math.round(range));
               gd.data("end", new_end);
               gd.find(".timedisplay").show().text(text);

               if(typeof(graph_zoom_timer) !== 'undefined') {
                 clearTimeout(graph_zoom_timer);
                 graph_zoom_timer = undefined;
               };

               graph_zoom_timer = setTimeout(function(_gd) {
                 graph_zoom_timer = undefined;
                 _gd.find(".timedisplay").hide();
                 _gd.find(".refresh").trigger("click");
               }, 500, gd);
             };

           };
         })
         .on("mousedown", function(e) {
           //e.preventDefault();
           let x = e.pageX - $(this).offset().left;
           let y = e.pageY - $(this).offset().top;
           let gd=$(this).closest(".graph_div");

           let chart=gd.data("chart");
           let chart_x=chart.chartArea.left;
           let chart_width=chart.chartArea.width;
           let chart_y=chart.chartArea.top;
           let chart_height=chart.chartArea.height;

           if( x >= chart_x && x <= (chart_x+chart_width) &&
               y >= chart_y && y <= (chart_y+chart_height)
           ) {
             if(typeof(graph_drag_timer) !== 'undefined') {
               clearTimeout(graph_drag_timer);
               graph_drag_timer = undefined;
             };
             let start=gd.data("real_start");
             if(typeof(start) === 'undefined') return;

             let range=gd.data("range");

             let cursor_time = Math.round( ((x - chart_x) / chart_width) * range ) + start;
             gd.data("drag_start", cursor_time);
             gd.data("ts_x", x);
             gd.find(".timedisplay").show().text(x);
           } else {
             gd.removeData("drag_start");
             gd.find(".timedisplay").hide();
           };

         })
         .on("mouseleave", function(e) {
           let gd=$(this).closest(".graph_div");
           if(typeof(gd.data("drag_start")) !== 'undefined') {
             gd.removeData("drag_start");
             gd.find(".timedisplay").hide();
           };
           if(typeof(graph_drag_timer) !== 'undefined') {
             clearTimeout(graph_drag_timer);
             graph_drag_timer = undefined;
           };
         })
         .on("mousemove", function(e) {
           //e.preventDefault();
           let x = e.pageX - $(this).offset().left;
           let y = e.pageY - $(this).offset().top;
           let gd=$(this).closest(".graph_div");

           let drag_start=gd.data("drag_start");

           if(typeof(drag_start) !== 'undefined') {
             if(typeof(graph_drag_timer) !== 'undefined') {
               clearTimeout(graph_drag_timer);
               graph_drag_timer = undefined;
             };
             let chart=gd.data("chart");
             let chart_x=chart.chartArea.left;
             let chart_width=chart.chartArea.width;
             let chart_y=chart.chartArea.top;
             let chart_height=chart.chartArea.height;

             if( x >= chart_x && x <= (chart_x+chart_width) &&
                 y >= chart_y && y <= (chart_y+chart_height)
             ) {
               let start=gd.data("real_start");
               if(typeof(start) === 'undefined') return;

               let range=gd.data("range");

               let cursor_time = Math.round( ((x - chart_x) / chart_width) * range ) + start;
               if(cursor_time > drag_start) {
                 gd.find(".timedisplay").show().text(from_unix_time(drag_start)+" - "+from_unix_time(cursor_time));
               } else {
                 gd.find(".timedisplay").show().text(from_unix_time(cursor_time)+" - "+from_unix_time(drag_start));
               };

               let ts_x=gd.data("ts_x");
               let ts_width=x - ts_x;
               if(ts_width < 0) {
                 ts_x = x;
                 ts_width = -(ts_width);
               };

               gd.data("ts_draw_x", ts_x);
               gd.data("ts_draw_width", ts_width);

               chart.update('none');
             } else {
               gd.removeData("drag_start");
               gd.find(".timedisplay").hide();
             };
           };

         })
         .on("mouseup", function(e) {
           //e.preventDefault();
           let x = e.pageX - $(this).offset().left;
           let y = e.pageY - $(this).offset().top;
           let gd=$(this).closest(".graph_div");

           let chart=gd.data("chart");
           let drag_start=gd.data("drag_start");

           if(typeof(drag_start) !== 'undefined') {
             let chart_x=chart.chartArea.left;
             let chart_width=chart.chartArea.width;
             let chart_y=chart.chartArea.top;
             let chart_height=chart.chartArea.height;
    
             if( x >= chart_x && x <= (chart_x+chart_width) &&
                 y >= chart_y && y <= (chart_y+chart_height)
             ) {
               let start=gd.data("real_start");
               if(typeof(start) === 'undefined') return;
    
               let range=gd.data("range");

               let cursor_time = Math.round( ((x - chart_x) / chart_width) * range ) + start;

               gd.find(".timedisplay").show().text(from_unix_time(drag_start)+" - "+from_unix_time(cursor_time));

               let new_range=cursor_time - drag_start;
               let new_end=cursor_time;

               if(new_range < 0) {
                 gd.find(".timedisplay").show().text(from_unix_time(cursor_time)+" - "+from_unix_time(drag_start));
                 new_range = -(new_range);
                 new_end = drag_start;
               } else {
                 gd.find(".timedisplay").show().text(from_unix_time(drag_start)+" - "+from_unix_time(cursor_time));
               };

               if(new_range < GRAPH_MIN_RANGE) new_range=GRAPH_MIN_RANGE;

               let now=unix_timestamp();
               if(new_end >= now) new_end='now';

               gd.data("end", new_end);
               gd.data("range", new_range);

               if(typeof(graph_drag_timer) !== 'undefined') {
                 clearTimeout(graph_drag_timer);
                 graph_drag_timer = undefined;
               };
               graph_drag_timer = setTimeout(function(_gd) {
                 _gd.find(".timedisplay").hide();
                 _gd.find(".refresh").trigger("click");
               }, 500, gd);
             };
             gd.removeData("drag_start");
           };
         })
       )
       .resizable({handles: "s,e"})
       .on("resize", function() {
         let size_x=$(this).innerWidth();
         let size_y=$(this).innerHeight();
         let gd=$(this).closest(".graph_div");
         let local_key=gd.data("local_key");
         save_local(local_key+"_size_x", size_x);
         save_local(local_key+"_size_y", size_y);
       })
     )
     .append( $(DIV).css({"white-space": "pre", "width": "100%", "text-align": "center"})
       .append( $(LABEL).addClass("start").css({"display": "inline-block", "float": "left"}) )
       .append( $(SPAN).css({"display": "inline-block", "margin": "auto", "font-size": "smaller"})
         .append( $(LABEL).addClass("button").text("1 мес").addClass("rangebtn").data("range", 31*24*60*60) )
         .append( $(LABEL).addClass("button").text("1 нед").addClass("rangebtn").data("range", 7*24*60*60) )
         .append( $(LABEL).addClass("button").text("1 день").addClass("rangebtn").data("range", 24*60*60) )
         .append( $(LABEL).addClass("button").text("12 час").addClass("rangebtn").data("range", 12*60*60) )
         .append( $(LABEL).addClass("button").text("1 час").addClass("rangebtn").data("range", 60*60) )
         .append( $(LABEL).addClass("button").text("NOW").css({})
           .click(function() {
             $(this).closest(".graph_div").data("end", "now").find(".refresh").trigger("click");
           })
         )
       )
       .append( $(LABEL).addClass("end").css({"display": "inline-block", "float": "right"}) )
     )
   )
  ;

  ret.find(".rangebtn")
   .click(function() {
     $(this).closest(".graph_div").data("range", $(this).data("range") ).find(".refresh").trigger("click");
   })
  ;

  let ctx=ret.find("CANVAS");

  const myPlugin={
    id: 'myPlugin',
    afterDraw(chart) {
      let gd=$(chart.canvas).closest(".graph_div");
 
      let scale_lefts=chart.scales.x.left;
      let scale_width=Number(chart.scales.x.width);

      let handle_width=Number(gd.find(".timebox").find(".handle").width())+2; //+ border

      gd.find(".timebox").find(".handle").css({"left": Number(scale_width/2 - handle_width/2)+"px"});

      gd.find(".timebox")
       .css({"top": chart.scales.x.top-1+"px", "left": chart.scales.x.left-1+"px", "width": chart.scales.x.width+"px", "height": chart.scales.x.height+"px"})
      ;

      if(typeof(gd.data("drag_start")) === 'undefined') return;
      let ts_draw_x=gd.data("ts_draw_x");
      let ts_draw_width=gd.data("ts_draw_width");
      if(typeof(ts_draw_x) === 'undefined') return;
      if(typeof(ts_draw_width) === 'undefined') return;

      let ctx=chart.ctx;
      let chartArea=chart.chartArea

      ctx.save();
      ctx.lineWidth=1;
      ctx.strokeStyle='gray';
      ctx.strokeRect(ts_draw_x, chartArea.top, ts_draw_width, chartArea.height);

      ctx.restore();
      //console.log(ts_draw_x + " : " + ts_draw_width);
    },
  };

  let options={ type: 'line',
    options: {
      animation: false,
      maintainAspectRatio: false,
      elements: {
        point: {
          radius: 0 // default to disabled in all datasets
        }
      },
      plugins: {
        tooltip: {
          position: 'bottom',
        },
      },
      interaction: {
        intersect: false,
        mode: 'index',
      },
      normalized: true,
      //parsing: false,
      locale: "ru-RU",
      scales: {
        x: {
          type: 'timeseries',
          time: {
            round: 'second',
            isoWeekday: true,
            tooltipFormat: 'd LLL yyyy HH:mm',
            displayFormats: {
              second: "HH:mm:ss",
              minute: "HH:mm",
              hour: "HH:mm",
              day: "d LLL HH:mm",
              week: "d LLL HH:mm",
              month: "d LLL HH:mm",
              quarter: "d LLL HH:mm",
              year: "d LLL YYYY HH:mm",
            },
          },
        },
        y: { beginAtZero: true, },
      },
    },
    "plugins": [ myPlugin ],
  };


  if(typeof(graph_options) !== 'undefined') {
    $.extend(true, options, graph_options);
  };

  let chart = new Chart(ctx, options);

  ret.data("chart", chart);

  return ret;
};
