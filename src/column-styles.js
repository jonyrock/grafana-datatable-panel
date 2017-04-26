import kbn from 'app/core/utils/kbn';

Array.prototype.swap = function(p, q) {
  var t = this[p];
  this[p] = this[q];
  this[q] = t;
  return this;
};

const DEFAULT_RENDER_FUNCTION =
`function(v) {
  return '~' + v + '~';
}
`;

const NEW_STYLE_DEFAULT = {
  unit: 'short',
  type: 'number',
  decimals: 2,
  colors: [
    "rgba(245, 54, 54, 0.9)",
    "rgba(237, 129, 40, 0.89)",
    "rgba(50, 172, 45, 0.97)"
  ],
  colorMode: null,
  pattern: '/.*/',
  thresholds: [],
  // default config for custom style
  renderFunction: DEFAULT_RENDER_FUNCTION
};

export const DEFAULT_CONFIG = [
  {
    type: 'date',
    pattern: 'Time',
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
  },
  NEW_STYLE_DEFAULT
];

export class ColumnsStylesManager {
  constructor(columnStylesConfig) {
    this.styles = columnStylesConfig;
  }

  isHidden(columnName) {
    var style = this.findStyle(columnName);
    return style && style.type === 'hidden';
  }

  findStyle(columnName) {
    for (let i = 0; i < this.styles.length; i++) {
      let style = this.styles[i];
      var regex = kbn.stringToJsRegex(style.pattern);
      if (columnName.match(regex)) {
        return style;
      }
    }
    return undefined;
  }

  addColumnStyle() {
    this.styles.push(angular.copy(NEW_STYLE_DEFAULT));
  }

  removeColumnStyle(index) {
    this.styles.splice(index, 1);
  }

  moveUpColumnStyle(index) {
    this.styles.swap(index - 1, index);
  }

  moveDownColumnStyle(index) {
    this.styles.swap(index + 1, index);
  }

  invertColorOrder(index) {
    this.styles[index].colors.swap(0, 2);
  }

}
