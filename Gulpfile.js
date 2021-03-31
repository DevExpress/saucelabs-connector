const { spawn } = require('child_process');
const babel     = require('gulp-babel');
const eslint    = require('gulp-eslint');
const gulp      = require('gulp');
const del       = require('del');


function clean () {
    return del('lib');
}

function build () {
    return gulp.src('src/**/*.js')
        .pipe(babel())
        .pipe(gulp.dest('lib/'));
}

function prerunScripts () {
    return gulp
        .src(['src/prerun/*.bat'])
        .pipe(gulp.dest('lib/prerun/'));
}

function lint () {
    return gulp
        .src(['src/**/*.js', 'Gulpfile.js'])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failOnError());
}

function test () {
    return spawn('npx jest', { stdio: 'inherit', shell: true });
}

exports.clean = clean;
exports.lint  = lint;
exports.build = gulp.parallel(lint, gulp.series(clean, gulp.parallel(build, prerunScripts)));
exports.test  = gulp.series(exports.build, test);
