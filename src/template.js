const Handlebars = require('handlebars');

Handlebars.registerHelper('removeBreak', (text) => {
  text = Handlebars.Utils.escapeExpression(text);
  text = text.replace(/(\r\n|\n|\r)/gm, ' ');
  return new Handlebars.SafeString(text);
});

class Template {
  constructor(templateString = '', data = {}) {
    this.template = Handlebars.compile(templateString);
    this.data = data;
  }

  setTemplate(templateString = '') {
    this.template = Handlebars.compile(templateString);
  }

  setData(data = {}) {
    this.data = data;
  }

  parse(callback) {
    callback(this.template(this.data));
  }
}

module.exports = Template;
