var babel  = require('gulp-babel');
var eslint = require('gulp-eslint');
var gulp   = require('gulp');
var del    = require('del');


gulp.task('clean', function () {
    return del('lib');
});

gulp.task('build', ['clean', 'lint'], function () {
    return gulp.src('src/**/*.js')
        .pipe(babel())
        .pipe(gulp.dest('lib/'));
});

gulp.task('lint', function () {
    return gulp
        .src(['src/**/*.js', 'Gulpfile.js'])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failOnError());
});
