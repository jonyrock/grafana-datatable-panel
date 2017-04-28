import jquery from 'jquery';

import kbn from 'app/core/utils/kbn';
import moment from 'moment';

import DataTable from './libs/datatables.net/js/jquery.dataTables.min.js';
import ColReorder from './external/datatables-colreorder/js/dataTables.colReorder.js';


export class DatatableRenderer {
  constructor(editMode, panel, table, isUtc, sanitize, colorder) {

    this.editMode = editMode;

    this.formatters = [];
    this.colorState = {};
    this.panel = panel;
    this.table = table;

    this.isUtc = isUtc;
    this.sanitize = sanitize;

    this._colorder = DatatableRenderer.nomalizeColorder(
      colorder, table.columns.length
    );

  }

  static nomalizeColorder(colorder, size) {
    var res = _.clone(colorder);
    if(res === undefined) {
      res = [];
    }
    while(res.length < size) {
      res.push(res.length);
    }
    if(res.length > size) {
      res = _.take(res, size);
    }
    res = _.map(res, (e,i) => ({ e:e, i:i }));
    res = _.sortBy(res, 'e');
    res = _.map(res, (ei,i) => ({ e: i, i: ei.i }));
    res = _.sortBy(res, 'i');
    res = _.map(res, e => e.e);
    return res;
  }

  getColorForValue(value, style) {
    if (!style.thresholds) {
      return null;
    }
    for (var i = style.thresholds.length; i > 0; i--) {
      if (value >= style.thresholds[i - 1]) {
        return style.colors[i];
      }
    }
    return _.first(style.colors);
  }

  // to determine the overall row color, the index of the threshold is needed
  getColorIndexForValue(value, style) {
    if (!style.thresholds) {
      return null;
    }
    for (var i = style.thresholds.length; i > 0; i--) {
      if (value >= style.thresholds[i - 1]) {
        return i;
      }
    }
    return 0;
  }

  defaultCellFormatter(v, style) {
    if (v === null || v === void 0 || v === undefined) {
      return '';
    }
    if (_.isArray(v)) {
      v = v.join(', ');
    }
    if (style && style.sanitize) {
      return this.sanitize(v);
    } else {
      return _.escape(v);
    }
  }

  createColumnFormatter(style, column) {
    if (!style) {
      return this.defaultCellFormatter;
    }
    if (style.type === 'date') {
      return v => {
        if (v === undefined || v === null) {
          return '-';
        }
        if (_.isArray(v)) {
          v = v[0];
        }
        var date = moment(v);
        if (this.isUtc) {
          date = date.utc();
        }
        return date.format(style.dateFormat);
      };
    }
    if (style.type === 'number') {
      let valueFormatter = kbn.valueFormats[column.unit || style.unit];
      return v => {
        if (v === null || v === undefined) {
          return '-';
        }
        if (_.isString(v)) {
          return this.defaultCellFormatter(v, style);
        }
        if (style.colorMode) {
          this.colorState[style.colorMode] = this.getColorForValue(v, style);
        }
        return valueFormatter(v, style.decimals, null);
      };
    }

    if (style.type === 'custom') {
      var src = '(' + style.renderFunction +')';
      /* jshint ignore:start */
      return eval(src);
      /* jshint ignore:end */
    }
    return (value) => {
      return this.defaultCellFormatter(value, style);
    };
  }

  formatColumnValue(colIndex, value) {
    if(!this.formatters[colIndex]) {
      let column = this.table.columns[colIndex];
      var style = this.panel.columnsStylesManager.findStyle(column.text);
      if(style) {
        this.formatters[colIndex] = this.createColumnFormatter(style, column);
      } else {
        this.formatters[colIndex] = this.defaultCellFormatter;
      }
    }
    return this.formatters[colIndex](value);
  }

  generateFormattedData(rowData) {
    let formattedRowData = [];
    for (var y = 0; y < rowData.length; y++) {
      let row = this.table.rows[y];
      let cellData = [];
      //cellData.push('');
      for (var i = 0; i < this.table.columns.length; i++) {
        cellData.push(this.formatColumnValue(i, row[i]));
      }
      if (this.panel.rowNumbersEnabled) {
        cellData.unshift('rowCounter');
      }
      formattedRowData.push(cellData);
    }
    return formattedRowData;
  }

  getStyleForColumn(columnNumber) {
    let colStyle = null;
    for (let i = 0; i < this.panel.styles.length; i++) {
      let style = this.panel.styles[i];
      let column = this.table.columns[columnNumber];
      if (column === undefined) break;
      var regex = kbn.stringToJsRegex(style.pattern);
      if (column.text.match(regex)) {
        colStyle = style;
        break;
      }
    }
    return colStyle;
  }

  createdCell(td, cellData, rowData, row, col) {
    // set the fontsize for the cell
    $(td).css('font-size', this.panel.fontSize);
    // undefined types should have numerical data, any others are already formatted
    let actualColumn = col;
    if (this.panel.rowNumbersEnabled) {
      actualColumn -= 1;
    }
    if (this.table.columns[actualColumn].type !== undefined) return;
    // for coloring rows, get the "worst" threshold
    var rowColor = null;
    var color = null;
    var rowColorIndex = null;
    var rowColorData = null;
    if (this.colorState.row) {
      // run all of the rowData through threshold check, get the "highest" index
      // and use that for the entire row
      if (rowData === null) return;
      rowColorIndex = -1;
      rowColorData = null;
      rowColor = this.colorState.row;
      // this should be configurable...
      color = 'white';
      for (let columnNumber = 0; columnNumber < this.table.columns.length; columnNumber++) {
        // only columns of type undefined are checked
        if (this.table.columns[columnNumber].type === undefined) {
          rowColorData =_this.getCellColors(
            this.colorState, columnNumber,
            rowData[columnNumber + rowNumberOffset]
          );
          if (rowColorData.bgColorIndex !== null) {
            if (rowColorData.bgColorIndex > rowColorIndex) {
              rowColorIndex = rowColorData.bgColorIndex;
              rowColor = rowColorData.bgColor;
            }
          }
        }
      }
      // style the entire row (the parent of the td is the tr)
      // this will color the rowNumber and Timestamp also
      $(td.parentNode).children().css('color', color);
      $(td.parentNode).children().css('background-color', rowColor);
    }

    if (this.colorState.rowcolumn) {
      // run all of the rowData through threshold check, get the "highest" index
      // and use that for the entire row
      if (rowData === null) return;
      rowColorIndex = -1;
      rowColorData = null;
      rowColor = this.colorState.rowcolumn;
      // this should be configurable...
      color = 'white';
      for (let columnNumber = 0; columnNumber < _this.table.columns.length; columnNumber++) {
        // only columns of type undefined are checked
        if (this.table.columns[columnNumber].type === undefined) {
          rowColorData = this.getCellColors(
            this.colorState, columnNumber,
            rowData[columnNumber + rowNumberOffset]
          );
          if (rowColorData.bgColorIndex !== null) {
            if (rowColorData.bgColorIndex > rowColorIndex) {
              rowColorIndex = rowColorData.bgColorIndex;
              rowColor = rowColorData.bgColor;
            }
          }
        }
      }
      // style the rowNumber and Timestamp column
      // the cell colors will be determined in the next phase
      if (this.table.columns[0].type !== undefined) {
        var children = $(td.parentNode).children();
        var aChild = children[0];
        $(aChild).css('color', color);
        $(aChild).css('background-color', rowColor);
        // the 0 column contains the row number, if they are enabled
        // then the above just filled in the color for the row number,
        // now take care of the timestamp
        if (this.panel.rowNumbersEnabled) {
          aChild = children[1];
          $(aChild).css('color', color);
          $(aChild).css('background-color', rowColor);
        }
      }
    }

    // Process cell coloring
    // Two scenarios:
    //    1) Cell coloring is enabled, the above row color is skipped
    //    2) RowColumn is enabled, the above row color is process, but we also
    //    set the cell colors individually
    var colorData = this.getCellColors(this.colorState, actualColumn, cellData);
    if ((this.colorState.cell) || (this.colorState.rowcolumn)) {
      if (colorData.color !== undefined) {
        $(td).css('color', colorData.color);
      }
      if (colorData.bgColor !== undefined) {
        $(td).css('background-color', colorData.bgColor);
      }
    } else if (this.colorState.value) {
      if (colorData.color !== undefined) {
        $(td).css('color', colorData.color);
      }
    }
  }

  getCellColors(colorState, columnNumber, cellData) {
    var items = cellData.split(/(\s+)/);
    // only color cell if the content is a number?
    var bgColor = null;
    var bgColorIndex = null;
    var color = null;
    var colorIndex = null;
    let colStyle = null;
    let value = null;
    // check if the content has a numeric value after the split
    if (!isNaN(items[0])) {
      // run value through threshold function
      value = parseFloat(items[0].replace(",", "."));
      colStyle = this.getStyleForColumn(columnNumber);
    }
    if (colStyle !== null) {
      // check color for either cell or row
      if ((colorState.cell) || (colorState.row) || (colorState.rowcolumn)){
        // bgColor = _this.colorState.cell;
        bgColor = this.getColorForValue(value, colStyle);
        bgColorIndex = this.getColorIndexForValue(value, colStyle);
        color = 'white';
      }
      // just the value color is set
      if (colorState.value) {
        //color = _this.colorState.value;
        color = this.getColorForValue(value, colStyle);
        colorIndex = this.getColorIndexForValue(value, colStyle);
      }
    }
    return {
      bgColor: bgColor,
      bgColorIndex: bgColorIndex,
      color: color,
      colorIndex: colorIndex
    };
  }
  /**
   * Construct table using Datatables.net API
   * multiple types supported
   * timeseries_to_rows (column 0 = timestamp)
   * timeseries_to_columns
   * timeseries_aggregations - column 0 is the metric name (series name, not a timestamp)
   * annotations - specific headers for this
   * table
   * json (raw)
   * columns[x].type === "date" then set columndefs to parse the date,
   * otherwise leave it as default
   * convert table.columns[N].text to columns formatted to datatables.net format
   * @return {[Boolean]} True if loaded without errors
   */
  render() {
    if (this.table.columns.length === 0) {
      return;
    }
    var columns = [];
    var columnDefs = [];
    var _this = this;
    var rowNumberOffset = 0;
    if (this.panel.rowNumbersEnabled) {
      rowNumberOffset = 1;
      columns.push({
        title: '',
        type: 'number'
      });
      columnDefs.push({
        "searchable": false,
        "orderable": false,
        "targets": 0,
        "width": "1%",
      });
    }
    for (let i = 0; i < this.table.columns.length; i++) {
      /* jshint loopfunc: true */
      columns.push({
        title: this.table.columns[i].text,
        type: this.table.columns[i].type
      });
      columnDefs.push({
        "targets": i + rowNumberOffset,
        "createdCell": this.createdCell.bind(this)
      });
    }

    try {
      var should_destroy = false;
      if ($.fn.dataTable.isDataTable('#datatable-panel-table-' + this.panel.id)) {
        var aDT = $('#datatable-panel-table-' + this.panel.id).DataTable();
        aDT.destroy();
        $('#datatable-panel-table-' + this.panel.id).empty();
      }
    }
    catch(err) {
      console.log("Exception: " + err.message);
    }
    // sanity check
    // annotations come back as 4 items in an array per row.
    // If the first row content is undefined, then modify to empty
    // since datatables.net throws errors
    if (this.table.rows[0].length === 4) {
      if (this.table.rows[0][0] === undefined) {
        // detected empty annotations
        this.table.rows = [];
      }
    }
    // pass the formatted rows into the datatable
    var formattedData = this.generateFormattedData(this.table.rows);

    if (this.panel.rowNumbersEnabled) {
      // shift the data to the right
    }
    var panelHeight = this.panel.panelHeight;
    let orderSetting = [[0, 'desc']];
    if (this.panel.rowNumbersEnabled) {
      // when row numbers are enabled, show them ascending
      orderSetting = [[0, 'asc']];
    }

    var tableOptions = {
      "lengthMenu": [
        [5, 10, 25, 50, 75, 100, -1],
        [5, 10, 25, 50, 75, 100, "All"]
      ],
      searching: this.panel.searchEnabled,
      info: this.panel.infoEnabled,
      lengthChange: this.panel.lengthChangeEnabled,
      scrollCollapse: false,
      saveState: true,
      data: formattedData,
      columns: columns,
      columnDefs: columnDefs,
      "search": { "regex": true },
      "order": orderSetting
    };

    if(this._colorder) {
      tableOptions.colReorder = { order: this._colorder };
    } else {
      tableOptions.colReorder = true;
    }

    if (this.panel.scroll) {
      tableOptions.paging = false;
      tableOptions.scrollY = panelHeight;
    } else {
      tableOptions.paging = true;
      tableOptions.pagingType = this.panel.datatablePagingType;
    }
    var newDT = $('#datatable-panel-table-' + this.panel.id).DataTable(tableOptions);
    _this.dt = newDT;

    newDT.on('column-reorder', function(e, settings, details) {
      _this.panel.colorder = _this.dt.colReorder.order();
    });

    // enable compact mode
    if (this.panel.compactRowsEnabled) {
      $('#datatable-panel-table-' + this.panel.id).addClass( 'compact' );
    }
    // enable striped mode
    if (this.panel.stripedRowsEnabled) {
      $('#datatable-panel-table-' + this.panel.id).addClass( 'stripe' );
    }
    if (this.panel.hoverEnabled) {
      $('#datatable-panel-table-' + this.panel.id).addClass( 'hover' );
    }
    if (this.panel.orderColumnEnabled) {
      $('#datatable-panel-table-' + this.panel.id).addClass( 'order-column' );
    }
    // these two are mutually exclusive
    if (this.panel.showCellBorders) {
      $('#datatable-panel-table-' + this.panel.id).addClass( 'cell-border' );
    } else {
      if (this.panel.showRowBorders) {
        $('#datatable-panel-table-' + this.panel.id).addClass( 'row-border' );
      }
    }
    if (!this.panel.scroll) {
      // set the page size
      if (this.panel.rowsPerPage !== null) {
        newDT.page.len(this.panel.rowsPerPage).draw();
      }
    }
    // function to display row numbers
    if (this.panel.rowNumbersEnabled) {
      newDT.on('order.dt search.dt', function () {
        newDT
          .column(0, {search:'applied', order:'applied'})
          .nodes()
          .each((cell, i) => cell.innerHTML = i + 1);
      }).draw();
    }
  }

  renderValues() {
    let rows = [];

    for (var y = 0; y < this.table.rows.length; y++) {
      let row = this.table.rows[y];
      let newRow = [];
      for (var i = 0; i < this.table.columns.length; i++) {
        newRow.push(this.formatColumnValue(i, row[i]));
      }
      rows.push(newRow);
    }

    return {
      columns: this.table.columns,
      rows: rows,
    };
  }

  get colorder() {
    if(this.dt && this.editMode) {
      return this.dt.colReorder.order();
    }
    return this._colorder;
  }

}
