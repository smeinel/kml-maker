var fs = require('fs');
var handlebars = require('handlebars');
var Q = require('q');
var $_ = require('underscore');

function write (dest, kml_data) {
	console.log('write_kml to', dest);
	var src = fs.readFileSync('./build/doc.kml.handlebars');
	var template = handlebars.compile(src.toString());
	fs.writeFileSync(dest, template(kml_data));
}

module.exports = {
	write: write
};
