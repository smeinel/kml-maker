var big = require('big.js');
var path = require('path');
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

kml_placemark.prototype.create_tile_data = function () {
	console.log('create_tile_data');
	var lat = big(this.north);
	var lon = big(this.west);
	var lat_range = lat.minus(this.south);
	var long_range = lon.minus(this.east);
	var lat_deg_per_px = lat_range.div(this.processed_file_data.h);
	var long_deg_per_px = long_range.div(this.processed_file_data.w);
	var x_remainder = this.processed_file_data.w % 1024;
	var y_remainder = this.processed_file_data.h % 1024;
	var tile_lat = lat_deg_per_px.times(1024);
	var tile_long = long_deg_per_px.times(1024);
	var tile_remainder_lat = lat_deg_per_px.times(y_remainder);
	var tile_remainder_long = long_deg_per_px.times(x_remainder);
	var img_stem = path.basename(this.processed_file_data.tile_dir) + '_tile-';
	var img_suffix = '.jpg';

	big.DP = 30;
	
	this.processed_file_data.tile_data = [];
	$_.each($_.range(this.processed_file_data.tiles_y), function (y) {
		var start_offset = tile_lat.times(y);
		var end_offset = (y < (this.tiles_y - 1)) ? tile_lat : tile_remainder_lat;
		var start_lat = lat.minus(start_offset);
		var end_lat = start_lat.minus(end_offset);
		$_.each($_.range(this.tiles_x), function (x) {
			var tile_no = (this.tiles_x * y) + x;
			var start_offset = tile_long.times(x);
			var end_offset = (x < (this.tiles_x - 1)) ? tile_long : tile_remainder_long;
			var start_long = lon.minus(start_offset);
			var end_long = start_long.minus(end_offset);
			this.tile_data.push({
				img: img_stem + tile_no + img_suffix,
				north: start_lat.toFixed(16),
				south: end_lat.toFixed(16),
				east: end_long.toFixed(16),
				west: start_long.toFixed(16)
			});
		}, this);
	}, this.processed_file_data);
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