var babel  = require('gulp-babel');
var eslint = require('gulp-eslint');
var gulp   = require('gulp');
var del    = require('del');


gulp.task('clean', function () {
    return del('lib');
});

gulp.task('build', ['lint', 'prerun-scripts'], function () {
    return gulp.src('src/**/*.js')
        .pipe(babel())
        .pipe(gulp.dest('lib/'));
});

gulp.task('prerun-scripts', ['clean'], function () {
    return gulp
        .src(['src/prerun/*.bat'])
        .pipe(gulp.dest('lib/prerun/'));
});

gulp.task('lint', function () {
    return gulp
        .src(['src/**/*.js', 'Gulpfile.js'])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failOnError());
});
