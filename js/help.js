/* global Shepherd */
const isTouchDevice = 'd' in document.documentElement;

// Create the Shepherd tour
const buttons = document.getElementById('buttons');
const formbox = document.getElementById('formbox');

var shepherd = new Shepherd.Tour({
  defaults: {
    classes: 'shepherd-theme-arrows',
    showCancelLink: true,
  },
});

// -- UPDATED STEPS FOR FAMILY TREE --

shepherd.addStep({
  text: [
    'Start by entering the name of a famous person.',
    'Try <em>"Queen Victoria"</em>, <em>"Albert Einstein"</em>, or <em>"Barack Obama"</em>.',
  ],
  attachTo: '#input bottom',
  buttons: [
    { text: 'Back', classes: 'shepherd-button-secondary', action: shepherd.back },
    { text: 'Next', classes: 'shepbtn', action: shepherd.next },
  ],
});

shepherd.addStep({
  text: [
    "Click 'Go' to load their profile.",
    'The visualizer will fetch data from Wikidata to build the tree.',
  ],
  attachTo: '#submit bottom',
  buttons: [
    { text: 'Back', classes: 'shepherd-button-secondary', action: shepherd.back },
    { text: 'Next', classes: 'shepbtn', action: shepherd.next },
  ],
  tetherOptions: {
    attachment: 'top left',
    targetAttachment: 'bottom center',
    offset: '0px -35px',
  },
});

shepherd.addStep({
  text: [
    '<strong>Expand the Tree:</strong>',
    '• Click <strong>▲</strong> to reveal Parents.',
    '• Click <strong>💍</strong> to reveal Spouses.',
    '• Click the <strong>Numbered Circle</strong> to reveal Children.',
    '• Click <strong>⇄</strong> (on hover) to show Siblings.',
  ],
  buttons: [
    { text: 'Back', classes: 'shepherd-button-secondary', action: shepherd.back },
    { text: 'Next', classes: 'shepbtn', action: shepherd.next },
  ],
});

// NEW STEP: Explanation of Action Buttons
shepherd.addStep({
  text: [
    '<strong>Toolbar Controls:</strong>',
    'Select a person on the graph to enable these tools:',
    'ℹ️ <strong>Info:</strong> View biography & details.',
    '📌 <strong>Pin:</strong> Lock a node in place.',
    '🗑️ <strong>Delete:</strong> Remove node from tree.',
  ],
  attachTo: '.button-container left',
  buttons: [
    { text: 'Back', classes: 'shepherd-button-secondary', action: shepherd.back },
    { text: "Let's Go!", classes: 'shepbtn', action: shepherd.next },
  ],
});

// Take away the info box when the tour has started...
shepherd.on('start', () => {
  document.getElementById('container').style.opacity = 0.3;
  document.getElementById('container').style.pointerEvents = 'none';
  if (formbox) formbox.style.opacity = 0.3;
  if (buttons) buttons.style.opacity = 0.3;
});

// ... and bring it back when the tour goes away
function opaque() {
  document.getElementById('container').style.opacity = '';
  document.getElementById('container').style.pointerEvents = '';
  if (formbox) formbox.style.opacity = 1;
  if (buttons) buttons.style.opacity = 1;
}
shepherd.on('complete', () => {
  opaque();
  document.querySelector('#input input').focus();
});
shepherd.on('cancel', opaque);

// Prompt user for input when none detected
function noInputDetected() {
  document.getElementById('container').style.opacity = 0.3;
  if (buttons) buttons.style.opacity = 0.3;
  shepherd.show();
}
