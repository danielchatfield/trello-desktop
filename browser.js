window.addEventListener('DOMContentLoaded', function () {
  const remote = require('electron').remote;
  let navigation       = document.createElement('nav');

  navigation.className = 'desktop-app-navigation';
  navigation.innerHTML =
    '<ul>' +
      '<li id="desktop-app-navigation-close"></li>' +
      '<li id="desktop-app-navigation-minimize"></li>' +
      '<li id="desktop-app-navigation-maximize"></li>' +
    '</ul>';

  document.getElementById('header').appendChild(navigation);

  document.getElementById("desktop-app-navigation-minimize").addEventListener("click", function (e) {
    remote.getCurrentWindow().minimize();
  });

  document.getElementById("desktop-app-navigation-maximize").addEventListener("click", function (e) {
    if (!remote.getCurrentWindow().isMaximized()) {
      remote.getCurrentWindow().maximize();
    } else {
      remote.getCurrentWindow().unmaximize();
    }
  });

  document.getElementById("desktop-app-navigation-close").addEventListener("click", function (e) {
    remote.getCurrentWindow().close();
  });

});
