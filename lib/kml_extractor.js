var fs = require('fs');
var Q = require('q');
var xml2js = require('xml2js');
var parsed_data;
var $_ = require('underscore');

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
        extract_placemarks();
        return deferred.resolve(result);
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
        $_.each(doc.Folder, function (folder) {
            if (folder.Placemark) {
                raw_placemarks = placemarks.concat(folder.Placemark);
            }
        });
    });
    $_.each(raw_placemarks, function (placemark) {
        var data = {
            name: placemark.name[0],
            description: placemark.description[0],
            file: null,
            bounds: []
        };
        // Look for the thumbnail link in the description. The PDF is named similarly.
        var re = /\/thumbnails\/[A-Za-z]{2}\/[\w\_]*_tn\.jpg/;
        var match = re.exec(data.description);
        //  Cut off '/thumbnails/ST/' and '_th.jpg'
        data.file = match[0].split('/').pop().split('_tn.jpg')[0] + '_geo.pdf';

        $_.each(placemark.Polygon, function (poly) {
            $_.each(poly.outerBoundaryIs, function (ob) {
                if (ob.LinearRing) {
                    data.bounds.push(get_latlonbox(clean_coord_string(ob.LinearRing[0].coordinates[0])));
                }
            });
        });
        placemarks.push(data);
    });
    return placemarks;
}

module.exports = {
    parse_file: parse_file,
    extract_placemarks: extract_placemarks
};
