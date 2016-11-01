// Todo: Small multiples on pivots instead of stacked
// Multiple y axes
// Toggle or checkbox for stacking charts
// Allow choice of yAxis
// build a true scatter plot? With multiple measures for multi-dimensional charts

(function() {

  var valueTemplate = `
    <lk-vis-on-off-option property="show_value_labels" label="Value Labels"></lk-vis-on-off-option>
    <lk-vis-on-off-option property="small_multiples" label="Small Multiples"></lk-vis-on-off-option>
    `

  var seriesTemplate = `
  <lk-flexible-series-editor-series
    support-types="true"
    support-full-field-name="true"
   />
    `

  looker.plugins.visualizations.registerEditorTemplates({
    for: "plotlyJs",
    templates: [
      {id: "values", name: "Values", template: valueTemplate},
      {id: "series", name: "Series", template: seriesTemplate}
    ]
  })


  var viz = {
    id: 'plotlyJs',
    label: 'PotlyJs',
    options: {
      show_value_labels: {
        type: "boolean",
        default: false
      },
      small_multiples: {
        type: "boolean",
        default: false
      }
    },

    create: function(element, settings) {
      this.id = _.uniqueId("plotly-");
      $elem = d3.select(element).append("div");
      $elem.attr("id", this.id);
    },
    destroy: function(){
      elem = document.getElementById(this.id);
      Plotly.purge(elem)
    },

    update: function(data, element, settings, resp) {
      if (element.clientHeight < 80)
        return
      var chart = this;
      elem = document.getElementById(this.id);
      elem.style.width = "100%";
      elem.style.height = element.clientHeight + "px";

      chart.plotData = []
      chart.layout = {}

      var createLayoutForTrace = function (dimension, measure, index) {

        var axisTitle = function (field){
          if (settings.show_view_names)
            return field.label;
          else
            return field.field_group_label || field.field_group_variant;
        }

        var xDomain = function(){
          var a = b = null;
          pivotLength = resp.pivots.length;

          a = (index - 1) / pivotLength;
          b = (index) / pivotLength - .05;

          return [a, b];
        }

        chart.layout.margin = {t: 0}
        if(index !== undefined && index !== 1){
          console.log(index)
          chart.layout["xaxis" + index] = {
            title: axisTitle(dimension),
            domain: xDomain()
          }
          chart.layout["yaxis" + index] = {
            title: axisTitle(measure),
            anchor: "x" + index
          }
        } else if (index === 1) {
          chart.layout.xaxis = {
            title: axisTitle(dimension),
            domain: xDomain()
          }
          chart.layout.yaxis = {
            title: axisTitle(measure)
          }
        } else {
          chart.layout.xaxis = {
            title: axisTitle(dimension),
          }
          chart.layout.yaxis = {
            title: axisTitle(measure)
          }

        }
      }

      var createTrace = function(measure, pivot, index) {
        var measureKey = seriesKey = measure.name;
        var dimension = resp.fields.dimension_like[0];
        var dimensionKey = dimension.name;
        if(pivot && pivot.key){
          var pivotKey = pivot.key;
          var seriesKey = pivotKey + " - " + measure.label;
        }

        var traceType = function() {
          type = settings.series_types[seriesKey]
          switch (type) {
            case "area":
              return "scatter";
            case "column":
              return "bar";
            case "line":
              return "lines";
            case "scatter":
              return "scatter";
            default:
              return undefined;
          }
        }

        // An area chart is just a filled in scatter plot
        var traceFillType = function() {
          type = settings.series_types[seriesKey]
          switch (type) {
            case "area":
              return "tozeroy";
            default:
              return undefined;
          }
        }

        // Eventually, this option may be exposed
        // For now we just don't have size on scatter
        var traceMarkerSize = function() {
          type = settings.series_types[seriesKey]
          switch (type) {
            case "scatter":
              return 8;
            default:
              return 0;
          }
        }

        var traceLineSize = function() {
          type = settings.series_types[seriesKey]
          switch (type) {
            case "scatter":
              return 0;
            default:
              return 1;
          }
        }

        var traceMode = function() {
          var type = settings.series_types[seriesKey]
          var mode = ""
          switch (type) {
            case "area":
              mode += "lines";
              break;
            case "line":
              mode += "lines";
              break;
            case "scatter":
              mode += "markers";
              break;
            default:
              break;
          }

          if (settings.show_value_labels) {
            return mode += "+text";
          }
          else{
            return mode;
          }
        }

        var trace = {
          y: [],
          x: [],
          name: (settings.series_labels && settings.series_labels[seriesKey]) || (pivot && pivot.label) || measure.label,
          type: traceType(),
          fill: traceFillType(),
          mode: traceMode(),
          text: [],
          marker: {
            color: settings.series_colors && settings.series_colors[seriesKey],
            size: traceMarkerSize()
          },
          line: {
            color: settings.series_colors && settings.series_colors[seriesKey],
            width: traceLineSize()
          }
        }

        getDimVal = function(d){
          var dimVal = ""
          resp.fields.dimension_like.forEach(function(dim){
            dimVal += d[dim.name].value;
          })
          return dimVal
        }

        data.forEach(function(d){
          if(pivotKey != null){
            trace.y.push(d[measureKey][pivotKey].value)
            trace.x.push(getDimVal(d))
          }
          else {
            trace.y.push(d[measureKey].value)
            trace.x.push(getDimVal(d))
          }
        })
        // Text needs to be assigned after the x/y
        // Eventually maybe we will get fancy here :()
        if (settings.show_value_labels) {
          trace.text = trace.y;
        }

        if(index && index !== 1 && settings.small_multiples == true) {
          trace.xaxis = "x" + index
          trace.yaxis = "y" + index
        }
        else {
          trace.xaxis = "x"
          trace.yaxis = "y"
        }

        createLayoutForTrace(dimension, measure, index)
        return trace
      }

      // In the future, maybe don't calculate x, y more than once, it's expensive
      // Hopefully that'll solve the dashboard resize sluggishness
      if(resp.fields.pivots.length > 0) {
        var i = 1;
        resp.pivots.forEach(function(pivot){
          resp.fields.measure_like.forEach(function(measure){
            chart.plotData.push(createTrace(measure, pivot, i))
            i++
          })
        })
      }
      else {
        resp.fields.measure_like.forEach(function(measure){
          chart.plotData.push(createTrace(measure))
        })
      }

      Plotly.newPlot( elem, chart.plotData, chart.layout);
      console.log(elem.data, elem.layout)
    }
  };
  looker.plugins.visualizations.add(viz);

}());
