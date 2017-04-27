import flatten from 'app/core/utils/flatten';
import TimeSeries from 'app/core/time_series2';
import TableModel from 'app/core/table_model';

import moment from 'moment';


const TRANSFORM_ERROR = 'Query result is not in table format, ' +
                        'try using another transform.';


export var transformers = {};

transformers.timeseries_to_rows = {
  description: 'Time series to rows',
  getColumns: function() {
    return [];
  },
  transform: function(data, panel, model) {
    model.columns = [
      {text: 'Time', type: 'date'},
      {text: 'Metric'},
      {text: 'Value'},
    ];

    for (var i = 0; i < data.length; i++) {
      var series = data[i];
      for (var y = 0; y < series.datapoints.length; y++) {
        var dp = series.datapoints[y];
        model.rows.push([dp[1], series.target, dp[0]]);
      }
    }
  },
};

transformers.timeseries_to_columns = {
  description: 'Time series to columns',
  getColumns: function() {
    return [];
  },
  transform: function(data, panel, model) {
    model.columns.push({text: 'Time', type: 'date'});

    // group by time
    var points = {};

    for (var i = 0; i < data.length; i++) {
      var series = data[i];

      model.columns.push({text: series.target});

      for (var y = 0; y < series.datapoints.length; y++) {
        var dp = series.datapoints[y];
        var timeKey = dp[1].toString();

        if (!points[timeKey]) {
          points[timeKey] = [dp[1]];
        }
        points[timeKey].push(dp[0]);
      }
    }

    for (var time in points) {
      var point = points[time];
      var values = [point.time];

      model.rows.push(point);
    }
  }
};

transformers.timeseries_aggregations = {
  description: 'Time series aggregations',
  getColumns: function() {
    return [
      {text: 'Avg', value: 'avg'},
      {text: 'Min', value: 'min'},
      {text: 'Max', value: 'max'},
      {text: 'Total', value: 'total'},
      {text: 'Current', value: 'current'},
      {text: 'Count', value: 'count'},
    ];
  },
  transform: function(data, panel, model) {
    var i, y;
    model.columns.push({text: 'Metric'});

    if (panel.columns.length === 0) {
      panel.columns.push({text: 'Avg', value: 'avg'});
    }

    for (i = 0; i < panel.columns.length; i++) {
      model.columns.push({text: panel.columns[i].text});
    }

    for (i = 0; i < data.length; i++) {
      var series = new TimeSeries({
        datapoints: data[i].datapoints,
        alias: data[i].target,
      });

      series.getFlotPairs('connected');
      var cells = [series.alias];

      for (y = 0; y < panel.columns.length; y++) {
        cells.push(series.stats[panel.columns[y].value]);
      }

      model.rows.push(cells);
    }
  }
};

transformers.annotations = {
  description: 'Annotations',
  getColumns: function() {
    return [];
  },
  transform: function(data, panel, model) {
    model.columns.push({text: 'Time', type: 'date'});
    model.columns.push({text: 'Title'});
    model.columns.push({text: 'Text'});
    model.columns.push({text: 'Tags'});

    if (!data || data.length === 0) {
      return;
    }

    for (var i = 0; i < data.length; i++) {
      var evt = data[i];
      model.rows.push([evt.min, evt.title, evt.text, evt.tags]);
    }
  }
};

transformers.table = {
  description: 'Table',
  getColumns: function(data) {
    if (!data || data.length === 0) {
      return [];
    }
  },
  transform: function(data, panel, model) {
    if (!data || data.length === 0) {
      return;
    }
    if (data[0] === undefined) {
      throw { message: TRANSFORM_ERROR };
    }
    if (data[0].type === undefined) {
      throw { message: TRANSFORM_ERROR };
    }
    if (data[0].type !== 'table') {
      throw { message: TRANSFORM_ERROR };
    }
    model.columns = data[0].columns;
    model.rows = data[0].rows;
  }
};

transformers.json = {
  description: 'JSON Data',
  getColumns: function(data) {
    if (!data || data.length === 0) {
      return [];
    }

    var names = {};
    for (var i = 0; i < data.length; i++) {
      var series = data[i];
      if (series.type !== 'docs') {
        continue;
      }

      // only look at 100 docs
      var maxDocs = Math.min(series.datapoints.length, 100);
      for (var y = 0; y < maxDocs; y++) {
        var doc = series.datapoints[y];
        var flattened = flatten(doc, null);
        for (var propName in flattened) {
          names[propName] = true;
        }
      }
    }

    return _.map(names, function(value, key) {
      return {text: key, value: key};
    });
  },
  transform: function(data, panel, model) {
    var i, y, z;
    for (i = 0; i < panel.columns.length; i++) {
      model.columns.push({text: panel.columns[i].text});
    }

    if (model.columns.length === 0) {
      model.columns.push({text: 'JSON'});
    }

    for (i = 0; i < data.length; i++) {
      var series = data[i];

      for (y = 0; y < series.datapoints.length; y++) {
        var dp = series.datapoints[y];
        var values = [];

        if (_.isObject(dp) && panel.columns.length > 0) {
          var flattened = flatten(dp, null);
          for (z = 0; z < panel.columns.length; z++) {
            values.push(flattened[panel.columns[z].value]);
          }
        } else {
          values.push(JSON.stringify(dp));
        }

        model.rows.push(values);
      }
    }
  }
};

function filterHiddenCols(dataAll, columnsStylesManager) {
  if(columnsStylesManager === undefined) {
    throw new Error('columnsStylesManager is undefined');
  }

  var data = dataAll[0];

  var cols = [];
  var rows = [];
  var hiddenIndexes = [];
  for(let i = 0; i < data.columns.length; i++) {
    var col = data.columns[i];
    if(columnsStylesManager.isHidden(col.text)) {
      hiddenIndexes.push(i);
    } else {
      cols.push(col);
    }
  }

  for(let i = 0; i < data.rows.length; i++) {
    var row = data.rows[i];
    var resRow = [];
    var hi = 0;
    for(let j = 0; j < row.length; j++) {
      if(hi < hiddenIndexes.length && hiddenIndexes[hi] == j) {
        hi++;
      } else {
        resRow.push(row[j]);
      }
    }
    rows.push(resRow);
  }

  var cdata = {
    columns: cols,
    rows: rows
  };

  _.defaults(cdata, data);

  return [cdata];
}

// TODO: remove dep to panel
export function transformDataToTable(data, panel) {
  var model = new TableModel();

  if (!data || data.length === 0) {
    return model;
  }

  var transformer = transformers[panel.transform];
  if (!transformer) {
    throw { message: 'Transformer ' + panel.transformer + ' not found' };
  }

  var cdata = filterHiddenCols(data, panel.columnsStylesManager);

  transformer.transform(cdata, panel, model);
  return model;
}
