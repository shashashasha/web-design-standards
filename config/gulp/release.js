var gulp = require('gulp');
var dutil = require('./doc-util');
var spawn = require('cross-spawn');
var runSequence = require('run-sequence');
var del = require('del');
var merge = require('merge-stream');
var task = /([\w\d-_]+)\.js$/.exec(__filename)[ 1 ];
var taskProcessAssets = task + ':process-assets';
var taskCloneAssets = task + ':clone-assets';
var taskAssets = task + ':assets';

gulp.task('make-tmp-directory', function (done) {

  dutil.logMessage('make-tmp-directory', 'Creating temporary release directory.');

  return gulp.src('dist/**/*')
    .pipe(gulp.dest(dutil.dirName));

});

gulp.task('clean-tmp-directory', function (done) {

  dutil.logMessage('clean-tmp-directory', 'Deleting temporary release directory.');

  return del(dutil.dirName);

});

gulp.task('clean-assets-directory', function () {

  dutil.logMessage('clean-assets-directory', 'Deleting temporary assets directories.');

  return del([
    'tmp-assets*',
    'dist/assets-*',
    '!dist/assets-*.zip',
  ]);

});

function createZipArchive (taskName, src, dest, done) {

  var zip = spawn('zip', [
    '--log-info',
    '-r',
    src,
    dest,
    '-x "*.DS_Store"',
  ]);

  zip.stdout.on('data', function (data) {

    if (/[\w\d]+/.test(data)) {

      dutil.logData(taskName, data);

    }

  });

  zip.stderr.on('data', function (data) {

    dutil.logError(taskName, data);

  });

  zip.on('error', function (error) {

    dutil.logError(taskName, 'Failed to create a zip archive');

    done(error);

  });

  zip.on('close', function (code) { if (0 === code) { done(); } });

}

gulp.task('zip-archives', function (done) {

  dutil.logMessage('zip-archives', 'Creating a zip archive in dist/' + dutil.dirName + '.zip');

  createZipArchive(
    'zip-archives',
    'dist/' + dutil.dirName + '.zip',
    dutil.dirName,
    done
  );

});

gulp.task(task, [ 'build' ], function (done) {

  dutil.logMessage(task, 'Creating a zip archive at dist/' + dutil.dirName + '.zip');

  runSequence(
    'make-tmp-directory',
    'zip-archives',
    'clean-tmp-directory',
    taskAssets,
    'clean-assets-directory',
    done
  );
});

gulp.task(taskCloneAssets, [ 'clean-assets-directory' ], function (done) {

  var repoURL = 'https://github.com/18F/web-design-standards-assets';

  dutil.logMessage(taskCloneAssets, 'Cloning ' + repoURL + ' into temporary directory');

  var git = spawn('git', [
    'clone',
    repoURL,
    'tmp-assets',
  ], { stdio: 'inherit' });

  git.on('error', function (error) { done(error); });

  git.on('close', function (code) { if (0 === code) { done(); } });

});

var streamExtensions = [
  'omnigraffle',
  'eps',
  'ai',
  'sketch',
];

gulp.task(taskProcessAssets, [ taskCloneAssets ], function (done) {

  dutil.logMessage(taskProcessAssets, 'Process files for ' + dutil.dirName + ' design assets');

  var files = streamExtensions.map(function (extension) {
    var source = [
      'tmp-assets/Fonts\ and\ pairings/**/*.zip',
      'tmp-assets/*.md',
      'tmp-assets/**/*.pdf',
    ];

    if ('ai' === extension) {
      source.push('tmp-assets/**/*ase*');
    }

    source.push('tmp-assets/**/*' + extension + '*');
    source.push('tmp-assets/**/*' + extension + '*');

    return source;
  });

  var streams = files.map(function (source, idx) {
    dutil.logMessage(taskProcessAssets, 'Processing ' + streamExtensions[ idx ]);
    source.forEach(function (f) {
      dutil.logData(taskProcessAssets, 'Processing ' + streamExtensions[ idx ] + ' ' + f);
    });
    return gulp.src(source, { base: 'tmp-assets' })
      .pipe(gulp.dest('dist/assets-' + streamExtensions[ idx ] + '-' + dutil.dirName));
  } );

  return merge.apply(this, streams);

});

gulp.task(taskAssets, [ taskProcessAssets ], function (done) {

  dutil.logMessage(taskAssets, 'Creating zip archives for ' + dutil.dirName + ' design assets');

  var streams = streamExtensions.map(function (extension, idx) {
    createZipArchive(
      'zip-archives',
      'dist/assets-' + extension + '-' + dutil.dirName + '.zip',
      'dist/assets-' + extension + '-' + dutil.dirName,
      function () {
        dutil.logData(taskAssets, 'Created zip archive for ' + dutil.dirName + ' design assets');
        if (idx === streamExtensions.length - 1) {
          setTimeout(done, 100);
        }
      }
    );
  });

});
