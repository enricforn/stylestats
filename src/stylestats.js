/*
 * stylestats
 * https://github.com/t32k/stylestats
 *
 * Copyright (c) 2014
 * Licensed under the MIT license.
 */

'use strict';

const _ = require('underscore');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const util = require('./util');
const Parser = require('./parser');
const Analyzer = require('./analyzer');

/**
 * StyleStats class
 * @param {Array} args
 * @param {String|Object} config
 * @constructor
 */
class StyleStats {

  constructor(args, config) {

    let that = this;
    const URL = /^(?:(?:ht|f)tp(?:s?)\:\/\/|~\/|\/)?(?:\w+:\w+@)?((?:(?:[-\w\d{1-3}]+\.)+(?:com|org|cat|coop|int|pro|tel|xxx|net|gov|mil|biz|info|mobi|name|aero|jobs|edu|co\.uk|ac\.uk|it|fr|tv|museum|asia|local|travel|[a-z]{2})?)|((\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)(\.(\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)){3}))(?::[\d]{1,5})?(?:(?:(?:\/(?:[-\w~!$+|.,=]|%[a-f\d]{2})+)+|\/)+|\?|#)?(?:(?:\?(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)(?:&(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)*)*(?:#(?:[-\w~!$ |\/.,*:;=]|%[a-f\d]{2})*)?$/;
    const EXTENSIONS = ['.less', '.styl', '.stylus', '.css'];

    args = Array.isArray(args) ? args : [args];

    this.urls = [];
    this.files = [];
    this.styles = [];

    // check arguments which is url or file path or other
    args.forEach((arg) => {
      if (util.isFile(arg) && EXTENSIONS.indexOf(path.extname(arg)) !== -1) {
        that.files.push(arg);
      } else if (util.isDirectory(arg)) {
        fs.readdirSync(arg)
          .filter((file) => EXTENSIONS.indexOf(path.extname(file)) !== -1)
          .forEach((file) => that.files.push(arg + file));
      } else if (URL.test(arg) && path.extname(arg).indexOf('.css') !== -1) {
        that.urls.push(arg);
      } else if (URL.test(arg)) {
        that.urls.push(arg);
      } else if (util.isCSS(arg)) {
        that.styles.push(arg);
      } else {
        glob.sync(arg)
          .filter((file) => path.extname(file) === '.css')
          .forEach((file) => that.files.push(file));
      }
    });

    let defaultOptions = require('../assets/default.json');
    let customOptions = {};

    if (config && util.isFile(config)) {

      let configString = fs.readFileSync(config, {
        encoding: 'utf8'
      });

      try {
        customOptions = JSON.parse(configString);
      } catch (e) {
        throw e;
      }
    } else if (_.isObject(config)) {
      customOptions = config;
    }

    this.options = _.extend({}, defaultOptions, customOptions);
    this.parser = new Parser(this.urls, this.files, this.styles, this.options);
  }

  /**
   * Parse css
   * @param {Function} callback
   */
  parse(callback) {

    this.parser.parse((error, data) => {

      if (error) {
        callback(error, null);
      }

      let analyzedData = new Analyzer(
        data.rules,
        data.selectors,
        data.declarations,
        data.cssString,
        data.cssSize,
        this.options
      ).analyze();

      let stats = {};

      if (this.options.published) {
        stats.published = new Date();
      }

      if (this.options.paths) {
        stats.paths = [];
        Array.prototype.push.apply(stats.paths, this.files);
        Array.prototype.push.apply(stats.paths, this.urls);
      }

      if (this.options.stylesheets) {
        stats.stylesheets = this.files.length + data.cssFiles - 0;
      }

      if (this.options.styleElements && data.styleElements) {
        stats.styleElements = data.styleElements;
      }

      _.extend(stats, analyzedData);
      if (this.options.mediaQueries) {
        stats.mediaQueries = data.mediaQueries;
      }

      callback(null, stats);
    });
  }
}

module.exports = StyleStats;
