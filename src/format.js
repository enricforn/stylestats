const fs = require('fs');
const path = require('path');
const json2csv = require('json2csv');
const Table = require('cli-table');
const prettify = require('../lib/prettify');
const Template = require('../lib/template');

class Format {

  constructor(data) {
    this.data = data;
    this.template = null;
  }

  setTemplate(templateString) {
    this.template = new Template(templateString, prettify(this.data));
  }

  setData(data) {
    this.data = data;
  }

  toTemplate(callback) {
    if (!this.template) {
      throw new Error('Template is not set');
    } else {
      this.template.parse(callback);
    }
  }

  toHTML(callback) {

    let templatePath = path.join(__dirname, '../assets/html.hbs');
    let templateString = fs.readFileSync(templatePath, {
      encoding: 'utf8'
    });

    this.template = new Template(templateString, prettify(this.data));
    this.template.parse(callback);
  }

  toMarkdown(callback) {

    let templatePath = path.join(__dirname, '../assets/markdown.hbs');
    let templateString = fs.readFileSync(templatePath, {
      encoding: 'utf8'
    });

    this.template = new Template(templateString, prettify(this.data));
    this.template.parse(callback);
  }

  toJSON(callback) {
    callback(JSON.stringify(this.data, null, 2));
  }

  toCSV(callback) {

    Object.keys(data).forEach((key) => {

      if (key === 'propertiesCount') {
        let array = [];
        this.data[key].forEach(function (item) {
          array.push([item.property + ':' + item.count]);
        });
        this.data[key] = array;
      }

      if (Array.isArray(data[key])) {
        this.data[key] = data[key].join(' ');
      }
    });

    json2csv({
      data: this.data,
      fields: Object.keys(this.data)
    }, function (error, csv) {
      if (error) {
        throw error;
      } else {
        callback(csv);
      }
    });
  }

  toTable(callback) {

    let table = new Table({
      style: {
        head: ['cyan'],
        compact: false
      }
    });

    prettify(this.data).forEach((row) => {
      table.push(row);
    });

    callback(table.toString());
  }
}

module.exports = Format;
