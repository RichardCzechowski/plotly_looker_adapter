(function() {

  var valueTemplate = `
    <lk-value-labels-option property="show_value_labels" label="Value Labels" default=false></lk-value-labels-option>
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
    options: {},

    create: function(element, settings) {
      this.id = _.uniqueId("plotly-");
      $elem = d3.select(element).append("div");
      $elem.attr("id", this.id);
    },
    destroy: function(){
      $elem = d3.select("#" + this.id)
      console.log($elem)
      $elem.remove();
    },

    update: function(data, element, settings, resp) {
      if (element.clientHeight < 80)
        return
      var chart = this;
      elem = document.getElementById(this.id);
      elem.style.width = "100%";
      elem.style.height = element.clientHeight + "px";

      chart.plotData = []
      layout = {}

      var createLayoutForTrace = function (dimension, measure) {

        var axisTitle = function (field){
          if (settings.show_view_names)
            return field.label;
          else
            return field.field_group_label || field.field_group_variant;
        }

        return {
          margin: { t: 0 },
          xaxis: {
            title: axisTitle(dimension)
          },
          yaxis: {
            title: axisTitle(measure)
          },
          showlegend: false
        }
      }

      var createTrace = function(measure, pivot) {
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
          name: settings.series_labels[seriesKey] || (pivot && pivot.label) || measure.label,
          type: traceType(),
          fill: traceFillType(),
          mode: traceMode(),
          text: [],
          marker: {
            color: settings.series_colors[seriesKey],
            size: traceMarkerSize()
          },
          line: {
            color: settings.series_colors[seriesKey],
            width: traceLineSize()
          }
        }

        getDimVal = function(d){
          var dimVal = ""
          resp.fields.dimension_like.forEach(function(dim){
            dimVal += d[dim.name].value + " ";
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
        trace.text = trace.y;

        layout = createLayoutForTrace(dimension, measure)
        return trace
      }

      // Don't calculate x, y more than once, it's expensive
      // Hopefully that'll solve the dashboard resize sluggishness
      if(resp.fields.pivots.length > 0) {
        resp.pivots.forEach(function(pivot){
          resp.fields.measure_like.forEach(function(measure){
            chart.plotData.push(createTrace(measure, pivot))
          })
        })
      }
      else {
        resp.fields.measure_like.forEach(function(measure){
          chart.plotData.push(createTrace(measure))
        })
      }

      console.log(chart, layout)
      Plotly.newPlot( elem, chart.plotData, layout);
    }
  };
  looker.plugins.visualizations.add(viz);

}());
