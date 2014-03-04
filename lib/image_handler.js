var fs = require('fs');
var path = require('path');
var pngparse = require("pngparse");
var Q = require('q');
var spawn = require('child_process').spawn;
var $_ = require('underscore');

function test_pixel (x, y, img_data) {
    var black = 0x000000FF;
    var px, r, g, b, a, idx;
    idx = ((img_data.width * y) + x) * 4;
    px = (img_data.data[idx] << 24) + (img_data.data[idx + 1] << 16) + (img_data.data[idx + 2] << 8) + img_data.data[idx + 3];
    r = (px & 0xFF000000) >>> 24;
    g = (px & 0x00FF0000) >>> 16;
    b = (px & 0x0000FF00) >>> 8;
    a = (px & 0x000000FF);
    return (black === (px | black));
}

function score_map_column (img_data, x) {
    var test_points = $_.range(0, img_data.height, 100);
    var test_score = 0;
    $_.each(test_points, function (test_y) {
        if (test_pixel(x, test_y, img_data)) {
            test_score += 1;
        }
    });
    return test_score;
}

function score_map_row (img_data, y) {
    var test_points = $_.range(0, img_data.width, 100);
    var test_score = 0;
    $_.each(test_points, function (test_x) {
        if (test_pixel(test_x, y, img_data)) {
            test_score += 1;
        }
    });
    return test_score;
}

function test_rows (img_data, test_east) {
    var start_x = (test_east) ? Math.floor(img_data.width * 0.75) : 0;
    var end_x = (test_east) ? img_data.width : Math.floor(img_data.width * 0.25);
    var cut_candidate = {x: -1, score: -1};
    $_.each($_.range(20), function (attempts) {
        var y = Math.floor(Math.random() * img_data.height);
        var x, test_score;
        for (x = start_x; x < end_x; x++) {
            if (test_pixel(x, y, img_data)) {
                test_score = score_map_column(img_data, x);
                if (cut_candidate.score < test_score) {
                    console.log('test score x', x, test_score, test_east);
                    cut_candidate.score = test_score;
                    cut_candidate.x = x;
                }
            }
        }
    });
    return cut_candidate.x;
}

function test_columns (img_data, test_south) {
    var start_y = (test_south) ? Math.floor(img_data.height * 0.75) : 0;
    var end_y = (test_south) ? img_data.height : Math.floor(img_data.height * 0.25);
    var cut_candidate = {y: -1, score: -1};
    $_.each($_.range(20), function (attempts) {
        var x = Math.floor(Math.random() * img_data.width);
        var y, test_score;
        for (y = start_y; y < end_y; y++) {
            if (test_pixel(x, y, img_data)) {
                test_score = score_map_row(img_data, y);
                if (cut_candidate.score < test_score) {
                    console.log('test score y', y, test_score, test_south);
                    cut_candidate.score = test_score;
                    cut_candidate.y = y;
                }
            }
        }
    });
    return cut_candidate.y;
}

function cut_map_image (res) {
    var deferred = Q.defer();
    if (!res.cut || ! res.src) {
        return deferred.reject(new Error('cut or src were not defined'));
    }
    var dest = res.src.slice(0, -4) + '-cropped.jpg';
    var cmd;
    var x = res.cut.w;
    var y = res.cut.n;
    var w = res.cut.e - x;
    var h = res.cut.s - y;
    console.log('cropping map', x, y, w, h);
    cmd = spawn('convert', ['-crop', w + 'x' + h + '+' + x + '+' + y, res.src, dest]);
    cmd.on('error', deferred.reject);
    cmd.on('close', function () {
        return deferred.resolve({
            w: w,
            h: h,
            img: dest
        });
    });

    return deferred.promise;
}

function get_map_image_borders (src) {
    /*
    This function examines the map PNG and locates the map borders. These will
    be used for cropping the image to only have the map and not include the
    white area, legend, etc.
    */
    var deferred = Q.defer();
    console.log('Find the map square!', src);
    pngparse.parseFile(src, function(err, data) {
        if (err) {
            return deferred.reject(err);
        }
        var png_data = data;
        var cut_lines = {
            n: test_columns(png_data, false),
            s: test_columns(png_data, true),
            e: test_rows(png_data, true),
            w: test_rows(png_data, false)
        };
        deferred.resolve({src: src, cut: cut_lines});
    });
    return deferred.promise;
}

function pdf_to_png (src) {
    var deferred = Q.defer();
    var dest = src.slice(0, -4) + '.png';
    var cmd;
    console.log(src, dest);
    // DBG
    // deferred.resolve(dest);
    // return deferred.promise;
    // end DBG
    if (fs.existsSync(src)) {
        console.log('source PDF found. converting...');
        cmd = spawn('convert', ['-density', '300', src, dest]);
        cmd.on('error', deferred.reject);
        cmd.on('close', function () {
            return deferred.resolve(dest);
        });
    } else {
        return deferred.reject(new Error('source PDF NOT FOUND ' + src));
    }
    return deferred.promise;
}

function tile_map_image (res) {
    var deferred = Q.defer();
    var dest_path = path.resolve(path.dirname(res.img), path.basename(res.img, path.extname(res.img)));
    var dest_file_pattern = path.basename(res.img, path.extname(res.img)) + '_tile.jpg';
    var cmd;
    if (!fs.existsSync(dest_path)) {
        fs.mkdirSync(dest_path);
    }
    cmd = spawn('convert', ['-crop', '1024x1024', res.img, path.resolve(dest_path, dest_file_pattern)]);
    cmd.on('error', deferred.reject);
    cmd.on('close', function () {
        res.tiles_x = Math.ceil(res.w / 1024);
        res.tiles_y = Math.ceil(res.h / 1024);
        return deferred.resolve(res);
    });

    return deferred.promise;
}

module.exports = {
    pdf_to_png: pdf_to_png,
    get_map_image_borders: get_map_image_borders,
    cut_map_image: cut_map_image,
    tile_map_image: tile_map_image
};
