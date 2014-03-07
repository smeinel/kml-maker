var $_ = require('underscore');

function kml_document () {
	this.name = '';
	this.folders = [];
}

kml_document.prototype.add_folder = function () {
	var folder = new kml_folder();
	this.folders.push(folder);
	return folder;
};

kml_document.prototype.get_placemarks = function () {
	var placemarks = [];
	$_.each(this.folders, function (folder) {
		placemarks = placemarks.concat(folder.placemarks);
	});
	return placemarks;
};

kml_document.prototype.get_ground_overlays = function () {
	var overlays = [];
	$_.each(this.folders, function (folder) {
		overlays = overlays.concat(folder.ground_overlays);
	});
	return overlays;
};

function kml_folder () {
	this.name = '';
	this.placemarks = [];
	this.ground_overlays = [];
}

kml_folder.prototype.add_placemark = function () {
	var placemark = new kml_placemark();
	this.placemarks.push(placemark);
	return placemark;
};

kml_folder.prototype.add_ground_overlay = function () {
	var ground_overlay = new kml_ground_overlay();
	this.ground_overlays.push(ground_overlay);
	return ground_overlay;
};

function kml_placemark () {
	this.name = '';
	this.description = '';
	this.file = '';
	this.north = null;
	this.south = null;
	this.east = null;
	this.west = null;
	this.processed_file_data = null;
}

kml_placemark.prototype.determine_file = function () {
	console.log(this.file);
    // Look for the thumbnail link in the description. The PDF is named similarly.
    var re = /\/thumbnails\/[A-Za-z]{2}\/[\w\_]*_tn\.jpg/;
    var match = re.exec(this.description);
    //  Cut off '/thumbnails/ST/' and '_th.jpg'
    this.file = match[0].split('/').pop().split('_tn.jpg')[0] + '_geo.pdf';
    return this.file;
};

kml_placemark.prototype.process_bounds = function (bounds) {
	this.north = bounds.north;
	this.south = bounds.south;
	this.east = bounds.east;
	this.west = bounds.west;
};

function kml_ground_overlay () {
	this.name = '';
	this.file = '';
	this.north = null;
	this.south = null;
	this.east = null;
	this.west = null;
}

function create_document () {
	return new kml_document();
}

module.exports = {
	create_document: create_document
};