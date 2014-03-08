var fs = require('fs');
var kml_data = require('./kml_data');
var Q = require('q');
var xml2js = require('xml2js');
var $_ = require('underscore');
var parsed_data;
var kml_docs = [];

function get_latlonbox (coord_strings) {
    var north = -91, south = 91, east = -181, west = 181;
    var lat, lon;
    $_.each(coord_strings, function (coord) {
        var parts = coord.split(',');
        lon = parseFloat(parts[0]);
        lat = parseFloat(parts[1]);
        north = Math.max(north, lat);
        south = Math.min(south, lat);
        east = Math.max(east, lon);
        west = Math.min(west, lon);
    });
    return {
        north: north,
        south: south,
        east: east,
        west: west
    };
}

function clean_coord_string (coord_string) {
    var cleaned = coord_string.replace(/[\n\t]/g, '').split(' ');
    var last = cleaned.pop();
    if (last.length) {
        cleaned.push(last);
    }
    return cleaned;
}

function parse_file (filename) {
    var parser = new xml2js.Parser();
    var deferred = Q.defer();

    parser.addListener('end', function(result) {
        parsed_data = result.kml.Document;
        return deferred.resolve(kml_docs);
    });

    fs.readFile(filename, function(err, data) {
        if (err) {
            return deferred.reject(err);
        }
        parser.parseString(data);
    });
    return deferred.promise;
}

function extract_placemarks () {
    var raw_placemarks = [];
    var placemarks = [];
    $_.each(parsed_data, function (doc) {
        var kml_doc = kml_data.create_document();
        kml_doc.name = doc.name[0];
        kml_docs.push(kml_doc);
        $_.each(doc.Folder, function (folder) {
            var kml_folder;
            if (folder.Placemark) {
                kml_folder = kml_doc.add_folder();
                kml_folder.name = folder.name[0];
                $_.each(folder.Placemark, function (pm) {
                    var placemark = kml_folder.add_placemark();
                    var bounds = [];
                    placemark.name = pm.name[0];
                    /*
                    Descriptions with HTML need to be placed in CDATA. I'm 
                    being lazy tonight and only testing for a < symbol.
                    */
                    placemark.description = (pm.description[0].indexOf('<') === -1) ? pm.description[0] : ('<![CDATA[' + pm.description[0] + ']]>');
                    placemark.determine_file();
                    $_.each(pm.Polygon, function (poly) {
                        $_.each(poly.outerBoundaryIs, function (ob) {
                            if (ob.LinearRing) {
                                bounds.push(get_latlonbox(clean_coord_string(ob.LinearRing[0].coordinates[0])));
                            } else {
                                console.error('boundary box is not LinearRing!!!');
                            }
                        });
                    });
                    if (bounds.length > 1) {
                        console.error('encountered more than 1 boundary box!!!');
                    }
                    placemark.process_bounds(bounds[0]);
                });
            }
        });
    });
    return kml_docs;
}

module.exports = {
    parse_file: parse_file,
    extract_placemarks: extract_placemarks,
    get_kml_docs: function () {
        return kml_docs;
    }
};
