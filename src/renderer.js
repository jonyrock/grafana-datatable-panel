import kbn from 'app/core/utils/kbn';
import moment from 'moment';

import DataTable from './libs/datatables.net/js/jquery.dataTables.js';
import './external/datatables-colreorder/js/dataTables.colReorder.js';
import './external/dataTables-responsive/dataTables.responsive.js';


export class DatatableRenderer {
  constructor(editMode, panel, table, isUtc, sanitize, colorder) {
    this.editMode = editMode;

    this.formatters = [];
    this.colorState = {};
    this.panel = panel;
    this.table = table;
    DatatableRenderer._filterHiddenCols(this.table, panel.columnsStylesManager);

    this.isUtc = isUtc;
    this.sanitize = sanitize;

    this._colorder = DatatableRenderer._nomalizeColorder(
      colorder, table.columns.length
    );
  }

  static _nomalizeColorder(colorder, size) {
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

  static _filterHiddenCols(table, columnsStylesManager) {
    if(columnsStylesManager === undefined) {
      throw new Error('columnsStylesManager is undefined');
    }

    var cols = [];
    var rows = [];
    var hiddenIndexes = [];
    for(let i = 0; i < table.columns.length; i++) {
      var col = table.columns[i];
      if(columnsStylesManager.isHidden(col.text)) {
        hiddenIndexes.push(i);
      } else {
        cols.push(col);
      }
    }

    for(let i = 0; i < table.rows.length; i++) {
      var row = table.rows[i];
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

    table.columns = cols;
    table.rows = rows;

  }

  _getColorForValue(value, style) {
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
  _getColorIndexForValue(value, style) {
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

  _defaultCellFormatter(v, style) {
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

  _createColumnFormatter(style, column) {
    if (!style) {
      return this._defaultCellFormatter;
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
          return this._defaultCellFormatter(v, style);
        }
        if (style.colorMode) {
          this.colorState[style.colorMode] = this._getColorForValue(v, style);
        }
        return valueFormatter(v, style.decimals, null);
      };
    }

    return (value) => {
      return this._defaultCellFormatter(value, style);
    };
  }

  _formatColumnValue(colIndex, value) {
    if(!this.formatters[colIndex]) {
      let column = this.table.columns[colIndex];
      var style = this.panel.columnsStylesManager.findStyle(column.text);
      if(style) {
        this.formatters[colIndex] = this._createColumnFormatter(style, column);
      } else {
        this.formatters[colIndex] = this._defaultCellFormatter;
      }
    }
    return this.formatters[colIndex](value);
  }

  _generateFormattedData(rowData) {
    let formattedRowData = [];
    for (var y = 0; y < rowData.length; y++) {
      let row = this.table.rows[y];
      let cellData = [];
      //cellData.push('');
      for (var i = 0; i < this.table.columns.length; i++) {
        cellData.push(this._formatColumnValue(i, row[i]));
      }
      if (this.panel.rowNumbersEnabled) {
        cellData.unshift('rowCounter');
      }
      formattedRowData.push(cellData);
    }
    return formattedRowData;
  }

  _getStyleForColumn(columnNumber) {
    let colStyle = null;
    for (let i = 0; i < this.panel.styles.length; i++) {
      let style = this.panel.styles[i];
      let column = this.table.columns[columnNumber];
      if (column === undefined) {
        break;
      }
      var regex = kbn.stringToJsRegex(style.pattern);
      if (column.text.match(regex)) {
        colStyle = style;
        break;
      }
    }
    return colStyle;
  }

  _createdCell(td, cellData, rowData, row, col) {
    // set the fontsize for the cell
    $(td).css('font-size', this.panel.fontSize);

    // undefined types should have numerical data, any others are already formatted
    let actualColumn = col;
    if (this.panel.rowNumbersEnabled) {
      actualColumn -= 1;
    }
    if (this.table.columns[actualColumn].type !== undefined) {
      return;
    }
    // for coloring rows, get the "worst" threshold
    var rowColor = null;
    var color = null;
    var rowColorIndex = null;
    var rowColorData = null;
    if (this.colorState.row) {
      // run all of the rowData through threshold check, get the "highest" index
      // and use that for the entire row
      if (rowData === null) {
        return;
      }
      rowColorIndex = -1;
      rowColorData = null;
      rowColor = this.colorState.row;
      // this should be configurable...
      color = 'white';
      for (let columnNumber = 0; columnNumber < this.table.columns.length; columnNumber++) {
        // only columns of type undefined are checked
        if (this.table.columns[columnNumber].type === undefined) {
          rowColorData =_this._getCellColors(
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
          rowColorData = this._getCellColors(
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
    var colorData = this._getCellColors(this.colorState, actualColumn, cellData);
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

  _getCellColors(colorState, columnNumber, cellData) {
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
      colStyle = this._getStyleForColumn(columnNumber);
    }
    if (colStyle !== null) {
      // check color for either cell or row
      if ((colorState.cell) || (colorState.row) || (colorState.rowcolumn)){
        // bgColor = _this.colorState.cell;
        bgColor = this._getColorForValue(value, colStyle);
        bgColorIndex = this._getColorIndexForValue(value, colStyle);
        color = 'white';
      }
      // just the value color is set
      if (colorState.value) {
        //color = _this.colorState.value;
        color = this._getColorForValue(value, colStyle);
        colorIndex = this._getColorIndexForValue(value, colStyle);
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
    const tableHolderId = '#datatable-panel-table-' + this.panel.id;
    try {
      if ($.fn.dataTable.isDataTable(tableHolderId)) {
        var aDT = $(tableHolderId).DataTable();
        aDT.destroy();
        $(tableHolderId).empty();
      }
    }
    catch(err) {
      console.log("Exception: " + err.message);
    }

    if (this.panel.emptyData) {
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
      var col = this.table.columns[i];
      columns.push({
        title: col.text,
        type: col.type
      });
      var colModifer = {
        "targets": i + rowNumberOffset,
        "_createdCell": this._createdCell.bind(this),
      };

      var style = this.panel.columnsStylesManager.findStyle(col.text);
      if(style && style.type === 'custom') {
        /* jshint ignore:start */
        var src = '(' + style.renderFunction +')';
        colModifer.render = eval(src);
        /* jshint ignore:end */
      }
      if(style && style.width) {
        colModifer.width = style.width + 'px';
      }

      columnDefs.push(colModifer);
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
    var formattedData = this._generateFormattedData(this.table.rows);

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
      "search": {
        "regex": true,
        "search": this.panel.searchValue
      },
      "order": orderSetting,
      "autoWidth": false
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

    var $datatable = $(tableHolderId);
    var newDT = $datatable.DataTable(tableOptions);

    new $.fn.dataTable.Responsive(newDT, { details: true });
    _this.dt = newDT;

    newDT.on('column-reorder', function(e, settings, details) {
      _this.panel.colorder = _this.dt.colReorder.order();
    });

    newDT.on('search.dt', function () {
      _this.panel.searchValue = newDT.search();
    });

    // enable compact mode

    if (this.panel.compactRowsEnabled) {
      $datatable.addClass('compact');
    }
    // enable striped mode
    if (this.panel.stripedRowsEnabled) {
      $datatable.addClass('stripe');
    }
    if (this.panel.hoverEnabled) {
      $datatable.addClass('hover');
    }
    if (this.panel.orderColumnEnabled) {
      $datatable.addClass('order-column');
    }
    // these two are mutually exclusive
    if (this.panel.showCellBorders) {
      $datatable.addClass('cell-border');
    } else {
      if (this.panel.showRowBorders) {
        $datatable.addClass('row-border');
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
        newRow.push(this._formatColumnValue(i, row[i]));
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


import './external/dataTables-responsive/dataTables.responsive.css!';
