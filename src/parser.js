const _ = require('underscore');
const fs = require('fs');
const url = require('url');
const path = require('path');
const Promise = require('promise');
const request = require('request');
const cheerio = require('cheerio');
const cssParse = require('css-parse');

const util = require('./util');

let currentFile;

/**
 * Get promised request
 * @param {Object} options
 * @returns {Promise}
 */
function requestSync(options) {
  return new Promise(function (resolve, reject) {
    request(options, function (error, response) {
      if (!error && response.statusCode === 200) {
        resolve(response);
      } else if (!error) {
        reject('Status code is ' + response.statusCode);
      } else {
        reject(error);
      }
    });
  });
}

class Parser {
  /**
   * Parser class
   * @param {Array} urls
   * @param {Array} files
   * @param {Array} styles
   * @constructor
   */
  constructor(urls, files, styles, options) {

    this.urls = urls;
    this.files = files;
    this.styles = styles;
    this.options = options;

    this.cssFiles = [];
    this.sassFiles = [];
    this.lessFiles = [];
    this.stylusFiles = [];

    this.files.forEach((file) => {
      var extname = path.extname(file);
      switch (extname) {
        case '.css':
          this.cssFiles.push(file);
          break;
        case '.less':
          this.lessFiles.push(file);
          break;
        case '.styl':
        case '.stylus':
          this.stylusFiles.push(file);
          break;
      }
    }, this);
  }

  /**
   * Parse css data
   * @param {Function} callback
   */
  parse(callback = function () {}) {

    // object to return
    let parsedData = {
      cssString: '',
      cssSize: 0,
      styleElements: 0,
      mediaQueries: 0,
      cssFiles: 0,
      rules: [],
      selectors: [],
      declarations: []
    };

    let that = this;

    // remote file requests
    let requestPromises = [];
    this.urls.forEach((url) => {
      let options = that.options.requestOptions;
      options.url = url;
      requestPromises.push(requestSync(options));
    });

    // css string array from arguments
    // they will be joined into css string
    this.cssFiles.forEach((cssFile) => {
      // push local css data
      that.styles.push(fs.readFileSync(cssFile, {
        encoding: 'utf8'
      }));
    });

    // LESS compile
    if (this.lessFiles.length !== 0) {
      let less = require('less');
      this.lessFiles.forEach((lessFile) => {
        let promise = new Promise((resolve, reject) => {
          let string = fs.readFileSync(lessFile, 'utf8').toString();
          less.render(string, {
            filename: path.resolve(lessFile)
          }).then((output) => resolve(output.css), (error) => reject(error));
        });
        requestPromises.push(promise);
      });
    }

    // Stylus compile
    if (this.stylusFiles.length !== 0) {
      let stylus = require('stylus');
      this.stylusFiles.forEach((stylusFile) => {
        let promise = new Promise((resolve, reject) => {
          let string = fs.readFileSync(stylusFile, 'utf8');
          stylus(string)
            .set('filename', stylusFile)
            .render((error, css) => {
              if (error) {
                reject(error);
              } else {
                resolve(css);
              }
            });
        });
        requestPromises.push(promise);
      });
    }

    // get remote files
    Promise.all(requestPromises).then((results) => {

      if (!that.urls.length && !that.files.length && !that.styles.length) {
        throw new Error('Argument is invalid');
      }

      // requests to stylesheet defined in html
      var requestPromisesInner = [];

      results.forEach(function (result) {
        if (util.isCSS(result)) {
          that.styles.push(result);
        } else {
          // push remote css data
          let type = result.headers['content-type'];
          if (type.indexOf('html') > -1) {
            // parse result body
            let $ = cheerio.load(result.body);
            let $link = $('link[rel=stylesheet]');
            let $style = $('style');

            // add css file count
            parsedData.cssFiles += $link.length;
            parsedData.styleElements += $style.length;

            // request link[href]
            $link.each(function () {
              let relativePath = $(this).attr('href');
              let absolutePath = url.resolve(result.request.href, relativePath);
              let options = that.options.requestOptions;
              options.url = absolutePath;
              requestPromisesInner.push(requestSync(options));
            });

            // add text in style tags
            $style.each(function () {
              that.styles.push($(this).text());
            });
          } else if (type.indexOf('css') !== -1) {
            parsedData.cssFiles += 1;
            that.styles.push(result.body);
          } else {
            throw new Error('Content type is not HTML or CSS!');
          }
        }
      });

      if (requestPromisesInner.length > 0) {
        return Promise.all(requestPromisesInner);
      } else {
        return true;
      }

    }).then((results) => {
      if (Array.isArray(results)) {
        results.forEach((result) => {
          that.styles.push(result.body);
        });
      }

      // join all css string
      parsedData.cssString = that.styles.join('');
      parsedData.cssSize = Buffer.byteLength(parsedData.cssString, 'utf8');

      // parse css string
      let rawRules = [];

      try {
        rawRules = cssParse(parsedData.cssString).stylesheet.rules;
      } catch (error) {
        throw new Error(error);
      }

      // check number of rules
      if (rawRules[0] === undefined) {
        throw new Error('Rule is not found.');
      }

      // add rules into result
      rawRules.forEach((rule) => {
        if (rule.type === 'rule') {
          parsedData.rules.push(rule);
        } else if (rule.type === 'media') {
          parsedData.mediaQueries += 1;
          rule.rules.forEach((rule) => {
            if (rule.type === 'rule') {
              parsedData.rules.push(rule);
            }
          });
        }
      });

      // add selectors and declarations into result
      parsedData.rules.forEach((rule) => {
        rule.selectors.forEach((selector) => {
          parsedData.selectors.push(selector);
        });
        rule.declarations.forEach((declaration) => {
          if (declaration.type === 'declaration') {
            parsedData.declarations.push(declaration);
          }
        });
      });

      callback(null, parsedData);

    }).catch((error) => callback(error, null));
  }
}

// export
module.exports = Parser;
