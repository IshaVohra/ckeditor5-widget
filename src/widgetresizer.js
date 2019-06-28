/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module widget/widget
 */

import WidgetResizeFeature from './widgetresizefeature';
import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import MouseObserver from './view/mouseobserver';
import MouseMoveObserver from './view/mousemoveobserver';

import getAncestors from '@ckeditor/ckeditor5-utils/src/dom/getancestors';

/**
 * Returns coordinates of top-left corner of a element, relative to the document's top-left corner.
 *
 * @param {HTMLElement} element
 * @returns {Object} return
 * @returns {Number} return.x
 * @returns {Number} return.y
 */
function getAbsolutePosition( element ) {
	const nativeRectangle = element.getBoundingClientRect();

	return {
		x: nativeRectangle.left + element.ownerDocument.defaultView.scrollX,
		y: nativeRectangle.top + element.ownerDocument.defaultView.scrollY
	};
}

class ResizeContext {
	constructor( handler ) {
		const widgetWrapper = getAncestors( handler ).filter(
			element => element.classList.contains( 'ck-widget_with-resizer' )
		)[ 0 ];

		this.widgetWrapper = widgetWrapper;
		this.shadowWrapper = widgetWrapper.querySelector( '.ck-widget__resizer-shadow' );

		// Reference edge (corner) that should be used to calculate resize difference.
		this.referenceCoordinates = getAbsolutePosition( handler );

		// Initial height of resizing host / resized element.
		// @todo: hardcoded img support
		const resizingHost = widgetWrapper.querySelector( 'img' );
		this.initialHeight = resizingHost.height;

		// Position of a clicked resize handler in x and y axes.
		this.direction = {
			y: 'top',
			x: 'left'
		};
	}

	initialize() {
		this.shadowWrapper.classList.add( 'ck-widget__resizer-shadow-active' );
	}

	destroy() {
		this.shadowWrapper.classList.remove( 'ck-widget__resizer-shadow-active' );
		this.shadowWrapper.removeAttribute( 'style' );

		this.shadowWrapper = null;
		this.wrapper = null;
	}

	updateSize( domEventData ) {
		const currentCoordinates = this._extractCoordinates( domEventData );
		const yDistance = this.referenceCoordinates.y - currentCoordinates.y;

		// For top, left handler:
		// yDistance > 0 - element is enlarged
		// yDistance < 0 - element is shrinked

		if ( yDistance > 0 ) {
			// console.log( 'enlarging' );
			this.shadowWrapper.style.top = ( yDistance * -1 ) + 'px';
		} else {
			// console.log( 'shrinking' );
			this.shadowWrapper.style.top = ( yDistance * -1 ) + 'px';
		}
	}

	// Accepts the proposed resize intent.
	commit() {
	}

	/**
	 *
	 * @param {module:@ckeditor/ckeditor5-core/src/editor/editor~Editor} editor
	 * @param {module:@ckeditor/ckeditor5-engine/src/view/element~Element} widgetWrapperElement
	 * @returns {module:@ckeditor/ckeditor5-engine/src/model/element~Element|undefined}
	 */
	_getModel( editor, widgetWrapperElement ) {
		return editor.editing.mapper.toModelElement( widgetWrapperElement );
	}

	_extractCoordinates( event ) {
		return {
			x: event.domEvent.pageX,
			y: event.domEvent.pageY
		};
	}
}

/**
 * The base class for widget features. This type provides a common API for reusable features of widgets.
 */
export default class WidgetResizer extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'WidgetResizer';
	}

	init() {
		const view = this.editor.editing.view;
		const viewDocument = view.document;

		this._observers = {
			mouseMove: view.addObserver( MouseMoveObserver ),
			mouseDownUp: view.addObserver( MouseObserver )
		};

		// It should start disabled, only upon clicking drag handler it interests us.
		// Currently broken due to https://github.com/ckeditor/ckeditor5-engine/blob/ce6422b/src/view/view.js#L364
		this._observers.mouseMove.disable();

		let isActive = false;
		let resizeContext = null;

		// Mouse move observer is only needed when the mouse button is pressed.
		// this.listenTo( viewDocument, 'mousemove', () => console.log( 'move' ) );
		this.listenTo( viewDocument, 'mousemove', ( event, domEventData ) => {
			if ( resizeContext ) {
				resizeContext.updateSize( domEventData );
			}
		} );

		this.listenTo( viewDocument, 'mousedown', ( event, domEventData ) => {
			const target = domEventData.domTarget;

			const resizeHandler = isResizeWrapper( target ) || getAncestors( target ).filter( isResizeWrapper )[ 0 ];

			if ( resizeHandler ) {
				isActive = true;
				this._observers.mouseMove.enable();

				resizeContext = new ResizeContext( resizeHandler );
				resizeContext.initialize( domEventData );
			}
		} );

		const finishResizing = () => {
			// @todo listen also for mouse up outside of the editable.
			if ( isActive ) {
				isActive = false;
				this._observers.mouseMove.disable();

				resizeContext.commit();
				resizeContext.destroy();
				resizeContext = null;
			}
		};

		// @todo: it should listen on the entire window.
		this.listenTo( viewDocument, 'mouseup', finishResizing );

		function isResizeWrapper( element ) {
			return element.classList && element.classList.contains( 'ck-widget__resizer' );
		}
	}

	apply( widgetElement, writer ) {
		// @todo inline the logic
		const ret = new WidgetResizeFeature();

		const renderRefresh = ret.apply( widgetElement, writer );

		this.editor.editing.view.once( 'render', renderRefresh );

		return ret;
	}
}
