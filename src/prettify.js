const numeral = require('numeral');
const aliases = require('../assets/aliases.json');

const KEY_BYTE = [
  'size',
  'gzippedSize',
  'dataUriSize'
];

const KEY_PERCENT = [
  'simplicity',
  'ratioOfDataUriSize'
];

/**
 * Prettify StyleStats data.
 * @param {object} [result] StyleStats parse data. Required.
 * @return {array} prettified data.
 */
function prettify(result) {
  var collections = [];
  Object.keys(result).forEach((key) => {
    let stats = {};
    let prop = aliases[key];
    if (key === 'propertiesCount') {
      let array = [];
      result[key].forEach(function (item) {
        array.push([item.property, item.count]);
      });
      stats[prop] = array.join('\n').replace(/\,/g, ': ');
    } else if (KEY_BYTE.indexOf(key) !== -1) {
      stats[prop] = numeral(result[key]).format('0.0b').replace(/\.0B/, 'B').replace(/0\.0/, '0');
    } else if (KEY_PERCENT.indexOf(key) !== -1) {
      stats[prop] = numeral(result[key]).format('0.0%');
    } else if (key === 'published' || key === 'paths') {
      return true;
    } else {
      stats[prop] = Array.isArray(result[key]) ? result[key].join('\n') : result[key];
      if (stats[prop] === '') {
        stats[prop] = 'N/A';
      }
    }
    collections.push(stats);
  });
  return collections;
}

module.exports = prettify;
