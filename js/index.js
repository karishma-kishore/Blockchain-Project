export class Listing extends HTMLElement {

    /* Bootstrap-aligned breakpoints : mobile <= 767px (xs) : tablet 768px to 1199px (sm/md) : desktop >= 1200px (lg+) */
    mediaQueryMobile = window.matchMedia('(max-width: 767px)');
    mediaQueryTablet = window.matchMedia('(max-width: 1199px)');
    mediaQueryDesktop = window.matchMedia('(min-width: 1200px)');

    constructor(){
        super();
        this.style.display = "block";

        // bind methods once and reuse
        this.handleMediaChange = this.handleMediaChange.bind(this);
        this.handleAjaxLoadMore = this.handleAjaxLoadMore.bind(this);
    }

    connectedCallback(){
        this.mediaQueryMobile.addEventListener('change', this.handleMediaChange);
        this.mediaQueryTablet.addEventListener('change', this.handleMediaChange);
        this.mediaQueryDesktop.addEventListener('change', this.handleMediaChange);
        document.addEventListener('ajaxLoadMore', this.handleAjaxLoadMore);
        this.adjustLayout(false);
    }

    disconnectedCallback(){
        this.mediaQueryMobile.removeEventListener('change', this.handleMediaChange);
        this.mediaQueryTablet.removeEventListener('change', this.handleMediaChange);
        this.mediaQueryDesktop.removeEventListener('change', this.handleMediaChange);
        document.removeEventListener('ajaxLoadMore', this.handleAjaxLoadMore);
    }

    /* Clean after completed media change and re-focus (remove grid focus data-tag) */
    cleanupDataAttributes(){
        document.querySelectorAll('[data-adjust-layout-focus]').forEach(function(el) {
            el.removeAttribute('data-adjust-layout-focus');
        });
    }

    /* Tag the focus element before updating the DOM layout based on latest media settings */
    tagFocus(){
        this.cleanupDataAttributes();
        if (document.activeElement) {
            document.activeElement.setAttribute('data-adjust-layout-focus', 'true');
        }
    }

    /* Reset focus to original position after updating DOM layout */
    reFocus(){
        let focusElems = document.querySelectorAll('[data-adjust-layout-focus]');
        if (focusElems.length > 0) {
            focusElems[0].focus();
        }
        this.cleanupDataAttributes();
    }

    /* Adjust the position of the -btn block DIV on a list item based on media settings (Desktop|Tablet|Mobile) - announce to screen reader if isMediaChange is true */
    adjustLayout(isMediaChange) {

        // supported pages have been updated to include the data-grid-btn-after attribute for mobile/tablet positioning of the -btn block
        if (!this.querySelector('.listing-element div[data-grid-btn-after]')) {
            return; // nothing to do
        }

        // supports ul and div containers
        if (this.querySelector('ul#divAllItems') === null && this.querySelector('div#divAllItems') === null) {
            return; // nothing to do
        }

        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        const isTablet = window.matchMedia('(max-width: 1199px)').matches;
        let dataGridLayout = 'desktop';
        if (isMobile) {
            dataGridLayout = 'mobile';
        } else if (isTablet) {
            dataGridLayout = 'tablet';
        }
        const notProcessedSelector = ':not([data-grid-layout="' + dataGridLayout + '"])';

        this.tagFocus(); // capture focus before updating DOM
        let rows = this.querySelectorAll('li .row' + notProcessedSelector);
        rows.forEach(row => {
            let btnBlock = row.querySelector('.listing-element__btn-block');
            if (btnBlock){
                if (dataGridLayout === 'desktop') {
                    let displayBlock = row.querySelector('.listing-element_display-block');
                    if (displayBlock) {
                        row.insertBefore(btnBlock, displayBlock); // insert before "More" block
                    } else {
                        row.appendChild(btnBlock);
                    }
                } else {
                    let insertBtnBlockAfter = row.querySelector('[data-grid-btn-after="' + dataGridLayout + '"]');
                    if (insertBtnBlockAfter) {
                        row.insertBefore(btnBlock, insertBtnBlockAfter.nextSibling);
                    }
                }
                // flag processed (re-process on media change)
                row.setAttribute('data-grid-layout', dataGridLayout);
            }
        });
        if (isMediaChange && a11yAnnounceToScreenReader) {
            a11yAnnounceToScreenReader('Page layout has changed based on new media settings');
        }
        this.reFocus(); // reset focus to original position before DOM update
    }

    /* Adjust layout for a media change (zoom +/- or mobile view) */
    handleMediaChange(e) {
        this.adjustLayout(true);
    }

    /* Adjust layout after loading new records (no media change but will adjust based on current media settings) */
    handleAjaxLoadMore(e) {
        this.adjustLayout(false);
    }

}
customElements.define('cg-listing', Listing);
