const _ = require('underscore');
const gzipSize = require('gzip-size');

class Analyzer {
  /**
   * Analyzer class
   * @param {Array} rules
   * @param {Array} selectors
   * @param {Array} declarations
   * @param {String} cssString
   * @param {Number} cssSize
   * @param {Object} options
   * @constructor
   */
  constructor(rules, selectors, declarations, cssString, cssSize, options) {
    // array of rule
    // referenced in analyzeRules
    this.rules = rules;

    // array of css selector
    // referenced in analyzeSelectors
    this.selectors = selectors;

    // array of css declaration
    // referenced in analyzeDeclarations
    this.declarations = declarations;

    // all of css string
    this.cssString = cssString;

    // size of css
    this.cssSize = cssSize;

    // result options
    this.options = options;
  }

  /**
   * Analyze rules
   * @returns {
   *   {Array} cssDeclarations
   * }
   */
  analyzeRules() {
    // object to return
    let result = {
      cssDeclarations: []
    };

    // analyze rules
    this.rules.forEach(function (rule) {
      if (Array.isArray(rule.declarations)) {
        result.cssDeclarations.push({
          selector: rule.selectors,
          count: rule.declarations.length
        });
      }
    });

    // sort by css declaration count
    result.cssDeclarations.sort((a, b) => b.count - a.count);

    return result;
  }

  /**
   * Analyze selectors
   * @returns {
   *   {Number} idSelectors,
   *   {Number} universalSelectors,
   *   {Number} unqualifiedAttributeSelectors,
   *   {Number} javascriptSpecificSelectors,
   *   {Array} identifiers
   * }
   */
  analyzeSelectors() {

    // object to return
    let result = {
      idSelectors: 0,
      universalSelectors: 0,
      unqualifiedAttributeSelectors: 0,
      javascriptSpecificSelectors: 0,
      userSpecifiedSelectors: 0,
      identifiers: []
    };

    // specified JavaScript hook selector
    let regexpJs = new RegExp(this.options.javascriptSpecificSelectors);
    // specified user-specified hook selector
    let regexpUser = new RegExp(this.options.userSpecifiedSelectors);

    // analyze selectors
    this.selectors.forEach((selector) => {

      // if it contains #
      if (selector.indexOf('#') > -1) {
        result.idSelectors += 1;
      }

      // if it contains *
      if (selector.indexOf('*') > -1) {
        result.universalSelectors += 1;
      }

      // if it is unqualified attribute selector
      if (selector.trim().match(/\[.+\]$/g)) {
        result.unqualifiedAttributeSelectors += 1;
      }

      // if it is for JavaScript hook
      if (regexpJs.test(selector.trim())) {
        result.javascriptSpecificSelectors += 1;
      }

      // if it is for user-specified hook
      if (regexpUser.test(selector.trim())) {
        result.userSpecifiedSelectors += 1;
      }

      // add selector for statistics
      let trimmedSelector = selector.replace(/\s?([\>|\+|\~])\s?/g, '$1');
      trimmedSelector = trimmedSelector.replace(/\s+/g, ' ');

      let count = trimmedSelector.split(/\s|\>|\+|\~|\:|[\w\]]\.|[\w\]]\#|\[/).length;
      result.identifiers.push({
        selector: selector,
        count: count
      });
    });

    // sort by chained selector count
    result.identifiers.sort((a, b) => b.count - a.count);

    return result;
  }

  /**
   * Analyze declarations
   * @returns {
   *   {String} dataUriSize,
   *   {Number} importantKeywords,
   *   {Number} floatProperties,
   *   {Array} uniqueFontSizes,
   *   {Array} uniqueFontFamilies
   *   {Array} uniqueColors,
   *   {Object} properties
   * }
   */
  analyzeDeclarations() {

    // object to return
    let result = {
      dataUriSize: '',
      importantKeywords: 0,
      floatProperties: 0,
      uniqueFontSizes: [],
      uniqueFontFamilies: [],
      uniqueColors: [],
      properties: {}
    };

    // analyze declarations
    this.declarations.forEach((declaration) => {

      // if it contains DataURI
      if (declaration.value.indexOf('data:image') > -1) {
        result.dataUriSize += declaration.value.match(/data\:image\/[A-Za-z0-9;,\+\=\/]+/);
      }

      // if it contains !important keyword
      if (declaration.value.indexOf('!important') > -1) {
        result.importantKeywords += 1;
      }

      // if it contains float
      if (declaration.property.indexOf('float') > -1) {
        result.floatProperties += 1;
      }

      // if it contains font-family
      if (declaration.property.indexOf('font-family') > -1) {
        result.uniqueFontFamilies.push(declaration.value.replace(/(\!important)/g, '').trim());
      }

      // if it contains font-size
      if (declaration.property.indexOf('font-size') > -1) {
        result.uniqueFontSizes.push(declaration.value.replace(/\!important/, '').trim());
      }

      // if it contains colors
      if (declaration.property.match(/^color$/)) {
        let color = declaration.value.replace(/\!important/, '');
        color = color.toUpperCase().trim();
        result.uniqueColors.push(color);
      }

      // property statistics
      if (result.properties[declaration.property]) {
        result.properties[declaration.property] += 1;
      } else {
        result.properties[declaration.property] = 1;
      }
    });

    // Return byte size.
    result.dataUriSize = Buffer.byteLength(result.dataUriSize, 'utf8');

    // Sort `font-family` property.
    result.uniqueFontFamilies = _.sortBy(_.uniq(result.uniqueFontFamilies));

    // Sort `font-size` property.
    result.uniqueFontSizes = _.sortBy(_.uniq(result.uniqueFontSizes).slice(), (item) => Number(item.replace(/[^0-9\.]/g, '')));

    // Sort `color` property.
    let trimmedColors = _.without(result.uniqueColors, 'TRANSPARENT', 'INHERIT');
    let formattedColors = trimmedColors.map(function (color) {
      let formattedColor = color;
      if (/^#([0-9A-F]){3}$/.test(formattedColor)) {
        formattedColor = color.replace(/^#(\w)(\w)(\w)$/, '#$1$1$2$2$3$3');
      }
      return formattedColor;
    });
    result.uniqueColors = _.sortBy(_.uniq(formattedColors));

    // Sort properties count.
    let propertiesCount = [];
    Object.keys(result.properties).forEach((key) => {
      propertiesCount.push({
        property: key,
        count: result.properties[key]
      });
    });

    // sort by property count
    result.properties = propertiesCount.sort((a, b) => b.count - a.count);

    return result;
  }

  /**
   * Analyze css from rules, selectors, declarations
   * @returns {
   *   {Number} stylesheets,
   *   {Number} size,
   *   {Number} dataUriSize,
   *   {Number} ratioOfDataUriSize,
   *   {Number} gzippedSize,
   *   {Number} rules,
   *   {Number} selectors,
   *   {Float}  simplicity,
   *   {Number} mostIdentifier,
   *   {String} mostIdentifierSelector,
   *   {Number} lowestCohesion,
   *   {Number} lowestCohesionSelector,
   *   {Number} totalUniqueFontSizes,
   *   {String} uniqueFontSizes,
   *   {Number} totalUniqueFontFamilies,
   *   {String} uniqueFontSizes,
   *   {Number} totalUniqueColors,
   *   {String} uniqueColors,
   *   {Number} totalUniqueFontFamilies
   *   {String} uniqueFontFamilies,
   *   {Number} idSelectors,
   *   {Number} universalSelectors,
   *   {Number} unqualifiedAttributeSelectors,
   *   {Number} javascriptSpecificSelectors,
   *   {Number} importantKeywords,
   *   {Number} floatProperties,
   *   {Number} propertiesCount
   * }
   */
  analyze() {

    // get analytics
    let rules = this.analyzeRules();
    let selectors = this.analyzeSelectors();
    let declarations= this.analyzeDeclarations();

    let analysis = {};
    if (this.options.size) {
      analysis.size = this.cssSize;
    }
    if (this.options.dataUriSize) {
      analysis.dataUriSize = declarations.dataUriSize;
    }
    if (this.options.dataUriSize && this.options.ratioOfDataUriSize && declarations.dataUriSize !== 0) {
      analysis.ratioOfDataUriSize = declarations.dataUriSize / this.cssSize;
    }
    if (this.options.gzippedSize) {
      analysis.gzippedSize = gzipSize.sync(this.cssString);
    }
    if (this.options.rules) {
      analysis.rules = this.rules.length;
    }
    if (this.options.selectors) {
      analysis.selectors = this.selectors.length;
    }
    if (this.options.rules && this.options.selectors && this.options.simplicity) {
      analysis.simplicity = analysis.rules / analysis.selectors;
    }
    // Most Identifier
    let mostIdentifier = selectors.identifiers.shift();
    if (mostIdentifier && this.options.mostIdentifier) {
      analysis.mostIdentifier = mostIdentifier.count;
    }
    if (mostIdentifier && this.options.mostIdentifierSelector) {
      analysis.mostIdentifierSelector = mostIdentifier.selector;
    }
    let lowestDefinition = rules.cssDeclarations.shift();
    if (lowestDefinition && this.options.lowestCohesion) {
      analysis.lowestCohesion = lowestDefinition.count;
    }
    if (lowestDefinition && this.options.lowestCohesionSelector) {
      analysis.lowestCohesionSelector = lowestDefinition.selector;
    }
    if (this.options.totalUniqueFontSizes) {
      analysis.totalUniqueFontSizes = declarations.uniqueFontSizes.length;
    }
    if (this.options.uniqueFontSizes) {
      analysis.uniqueFontSizes = declarations.uniqueFontSizes;
    }
    if (this.options.totalUniqueFontFamilies) {
      analysis.totalUniqueFontFamilies = declarations.uniqueFontFamilies.length;
    }
    if (this.options.uniqueFontFamilies) {
      analysis.uniqueFontFamilies = declarations.uniqueFontFamilies;
    }
    if (this.options.totalUniqueColors) {
      analysis.totalUniqueColors = declarations.uniqueColors.length;
    }
    if (this.options.uniqueColors) {
      analysis.uniqueColors = declarations.uniqueColors;
    }
    if (this.options.idSelectors) {
      analysis.idSelectors = selectors.idSelectors;
    }
    if (this.options.universalSelectors) {
      analysis.universalSelectors = selectors.universalSelectors;
    }
    if (this.options.unqualifiedAttributeSelectors) {
      analysis.unqualifiedAttributeSelectors = selectors.unqualifiedAttributeSelectors;
    }
    if (this.options.javascriptSpecificSelectors) {
      analysis.javascriptSpecificSelectors = selectors.javascriptSpecificSelectors;
    }
    if (this.options.userSpecifiedSelectors) {
      analysis.userSpecifiedSelectors = selectors.userSpecifiedSelectors;
    }
    if (this.options.importantKeywords) {
      analysis.importantKeywords = declarations.importantKeywords;
    }
    if (this.options.floatProperties) {
      analysis.floatProperties = declarations.floatProperties;
    }
    if (this.options.propertiesCount) {
      analysis.propertiesCount = declarations.properties.slice(0, this.options.propertiesCount);
    }
    return analysis;
  }
}

module.exports = Analyzer;
