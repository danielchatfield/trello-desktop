/* jshint esversion:6 */
window.addEventListener('DOMContentLoaded', () => {
  const remote = require('electron').remote;
  const navigation = document.createElement('nav');

  navigation.className = 'desktop-app-navigation';
  navigation.innerHTML =
    '<ul>' +
    '<li id="desktop-app-navigation-close"></li>' +
    '<li id="desktop-app-navigation-minimize"></li>' +
    '<li id="desktop-app-navigation-maximize"></li>' +
    '</ul>';

  document.getElementById('header').appendChild(navigation);

  document.getElementById('desktop-app-navigation-minimize').addEventListener('click', () => {
    remote.getCurrentWindow().minimize();
  });

  document.getElementById('desktop-app-navigation-maximize').addEventListener('click', () => {
    if (remote.getCurrentWindow().isMaximized()) {
      remote.getCurrentWindow().unmaximize();
    } else {
      remote.getCurrentWindow().maximize();
    }
  });

  document.getElementById('desktop-app-navigation-close').addEventListener('click', () => {
    remote.getCurrentWindow().close();
  });
});
