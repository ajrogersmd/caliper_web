let currentColor = '#FF3B30';
        let caliperCount = 0;
        let activeReferenceCaliper = null;
        let currentReferenceMsSetting = 1000;
        let isDragging = false;
        let dragTarget = null;
        let dragOffset = { x: 0, y: 0 };

        let pdfDoc = null;
        let currentPDFPage = 1;
        let totalPDFPages = 0;

        const PDF_RENDER_SCALE = 10;
        const CALIPER_LINE_WIDTH = 1;
        document.documentElement.style.setProperty('--caliper-line-width', `${CALIPER_LINE_WIDTH}px`);
        const pdfControls = document.getElementById('pdfControls');
        const pageIndicator = document.getElementById('pageIndicator');
        const prevPDFBtn = document.getElementById('prevPDFBtn');
        const nextPDFBtn = document.getElementById('nextPDFBtn');
        if (prevPDFBtn) prevPDFBtn.addEventListener('click', prevPDFPage);
        if (nextPDFBtn) nextPDFBtn.addEventListener('click', nextPDFPage);
        if (window['pdfjsLib']) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const dropZone = document.getElementById('dropZone');
        const contentArea = document.getElementById('contentArea');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, preventDefaults, false));
        function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
        ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false));
        ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false));
        dropZone.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) handleFiles(files);
        }
        function handleFiles(files) {
            const file = files.shift();
            if (!file) return;
            const reader = new FileReader();
            if (file.type.startsWith('image/')) {
                reader.onload = ev => displayImage(ev.target.result);
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('text/')) {
                reader.onload = ev => displayText(ev.target.result);
                reader.readAsText(file);
            } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                reader.onload = ev => displayPDF(ev.target.result);
                reader.readAsArrayBuffer(file);
            }
        }
        function handleFileSelect(event) { if (event.target.files.length > 0) handleFiles(Array.from(event.target.files)); }
        async function handlePaste() {
            try {
                const clipboardItems = await navigator.clipboard.read();
                for (const item of clipboardItems) {
                    if (item.types.some(type => type.startsWith('image/'))) {
                        const blob = await item.getType(item.types.find(type => type.startsWith('image/')));
                        const reader = new FileReader(); reader.onload = ev => displayImage(ev.target.result); reader.readAsDataURL(blob); return;
                    }
                }
                const text = await navigator.clipboard.readText(); if (text) displayText(text);
            } catch (err) {
                console.error('Paste error:', err);
                const manualText = prompt('Could not automatically paste. Please paste TEXT content here:'); if (manualText) displayText(manualText);
            }
        }
        function displayImage(src) {
            contentArea.innerHTML = `<button class="clear-content" onclick="clearContent()">× Clear Content</button><img src="${src}" class="pasted-image" alt="Pasted content">`;
            showContent();
        }
        function displayText(text) {
            contentArea.innerHTML = `<button class="clear-content" onclick="clearContent()">× Clear Content</button><div class="pasted-text">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
            showContent();
        }
        function displayPDF(arrayBuffer) {
            pdfjsLib.getDocument({ data: arrayBuffer }).promise.then(pdf => {
                pdfDoc = pdf;
                totalPDFPages = pdf.numPages;
                currentPDFPage = 1;
                renderPDFPage(currentPDFPage);
                if (pdfControls) pdfControls.style.display = 'flex';
            });
        }
        function renderPDFPage(num) {
            if (!pdfDoc) return;
            pdfDoc.getPage(num).then(page => {
                const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                page.render({ canvasContext: ctx, viewport: viewport }).promise.then(() => {
                    const imgData = canvas.toDataURL('image/png');
                    displayImage(imgData);
                    updatePDFPageIndicator();
                });
            });
        }
        function nextPDFPage() {
            if (currentPDFPage < totalPDFPages) {
                currentPDFPage++;
                renderPDFPage(currentPDFPage);
            }
        }
        function prevPDFPage() {
            if (currentPDFPage > 1) {
                currentPDFPage--;
                renderPDFPage(currentPDFPage);
            }
        }
        function updatePDFPageIndicator() {
            if (pageIndicator) pageIndicator.textContent = `${currentPDFPage} / ${totalPDFPages}`;
        }
        function hidePDFControls() {
            if (pdfControls) pdfControls.style.display = 'none';
        }
        function showContent() {
            dropZone.classList.add('has-content'); contentArea.classList.add('has-content');
        }
        function clearContent() {
            contentArea.innerHTML = ''; contentArea.classList.remove('has-content'); dropZone.classList.remove('has-content');
            clearAllCalipers();
            pdfDoc = null; currentPDFPage = 1; totalPDFPages = 0; hidePDFControls();
        }

        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', function() {
                document.querySelector('.color-option.selected').classList.remove('selected'); this.classList.add('selected');
                currentColor = this.dataset.color; updateAllCaliperColors();
            });
        });
        function updateAllCaliperColors() {
            document.querySelectorAll('.caliper').forEach(caliper => {
                caliper.style.color = currentColor; caliper.style.setProperty('--caliper-color', currentColor);
            });
        }

        function addReferenceCaliper() { createCaliper({isReference: true}); }
        function addRhythmCaliper() { createCaliper({isRhythm: true}); }
        function createCaliper(options = {}) {
            const { isReference = false, isRhythm = false } = options;
            caliperCount++; const caliper = document.createElement('div');
            caliper.className = 'caliper'; caliper.id = `caliper-${caliperCount}`;
            caliper.style.color = currentColor; caliper.style.setProperty('--caliper-color', currentColor);

            const initialWidth = 100; const interactiveHeight = 100;
            const verticalLineRenderHeight = interactiveHeight * 10;
            const verticalLineTopInCaliperSpace = (interactiveHeight / 2) - (verticalLineRenderHeight / 2);
            let rhythmElementsHTML = '';
            if (isRhythm) {
                caliper.dataset.isRhythm = "true"; rhythmElementsHTML = `<div class="rhythm-extension-line"></div>`;
                for (let i = 0; i < 5; i++) rhythmElementsHTML += `<div class="rhythm-tick-mark tick-${i}"></div>`;
            }
            caliper.innerHTML = `
                <div class="caliper-line caliper-vertical" style="left: 0; top: ${verticalLineTopInCaliperSpace}px; height: ${verticalLineRenderHeight}px;" data-type="left"></div>
                <div class="caliper-line caliper-vertical" style="left: ${initialWidth}px; top: ${verticalLineTopInCaliperSpace}px; height: ${verticalLineRenderHeight}px;" data-type="right"></div>
                <div class="caliper-line caliper-horizontal" style="left: 0; top: ${interactiveHeight / 2}px; width: ${initialWidth}px;" data-type="horizontal"></div>
                <div class="caliper-handle" style="left: 0; top: ${interactiveHeight / 2}px;" data-type="left-handle"></div>
                <div class="caliper-handle" style="left: ${initialWidth}px; top: ${interactiveHeight / 2}px;" data-type="right-handle"></div>
                <div class="caliper-handle" style="left: ${initialWidth / 2}px; top: ${interactiveHeight / 2}px;" data-type="move-handle"></div>
                <div class="caliper-label" style="left: ${initialWidth + 10}px; top: ${interactiveHeight / 2 - 10}px;">${initialWidth} px</div>
                ${rhythmElementsHTML}`;

            let startX, startY;
            startX = 50 + (caliperCount * 25 % (window.innerWidth - initialWidth - 100));
            startY = 50 + (caliperCount * 15 % (window.innerHeight - interactiveHeight - 100));
            caliper.style.left = startX + 'px'; caliper.style.top = startY + 'px';
            caliper.dataset.width = initialWidth; caliper.dataset.interactiveHeight = interactiveHeight;
            caliper.dataset.verticalLineRenderHeight = verticalLineRenderHeight;

            if (isReference) {
                if (activeReferenceCaliper && activeReferenceCaliper.parentNode) {
                    activeReferenceCaliper.classList.remove('is-reference-caliper'); activeReferenceCaliper.remove();
                }
                activeReferenceCaliper = caliper; caliper.dataset.isReference = "true"; caliper.classList.add('is-reference-caliper');
            } else { caliper.classList.remove('is-reference-caliper'); }

            document.body.appendChild(caliper); updateReferenceUIDisabledState();
            caliper.addEventListener('contextmenu', e => { e.preventDefault(); removeCaliper(caliper); });
            setupCaliperInteraction(caliper); updateCaliperVisuals(caliper, initialWidth, interactiveHeight);
            if(isReference || activeReferenceCaliper) updateAllCaliperLabels();
        }

        // Unified Interaction Handlers for Mouse and Touch
        const onInteractionMove = function(eMove) {
            if (!isDragging || !dragTarget) return;
            if (eMove.type === 'touchmove') eMove.preventDefault();

            const clientX = eMove.type === 'touchmove' ? eMove.touches[0].clientX : eMove.clientX;
            const clientY = eMove.type === 'touchmove' ? eMove.touches[0].clientY : eMove.clientY;

            const { caliper, type, initialCaliperLeft, initialCaliperWidth } = dragTarget;
            const interactiveHeight = parseFloat(caliper.dataset.interactiveHeight);
            let newCaliperX, newCaliperWidth;

            switch(type) {
                case 'move-handle': case 'horizontal':
                    caliper.style.left = (clientX - dragOffset.x) + 'px';
                    caliper.style.top = (clientY - dragOffset.y) + 'px';
                    break;
                case 'left-handle': case 'left':
                    newCaliperX = clientX - dragOffset.x;
                    const fixedRightEdgeAbsolute = initialCaliperLeft + initialCaliperWidth;
                    newCaliperWidth = fixedRightEdgeAbsolute - newCaliperX;
                    if (newCaliperWidth > 10) {
                        caliper.style.left = newCaliperX + 'px';
                        updateCaliperVisuals(caliper, newCaliperWidth, interactiveHeight);
                    }
                    break;
                case 'right-handle': case 'right':
                    newCaliperWidth = clientX - initialCaliperLeft;
                    if (newCaliperWidth > 10) {
                        updateCaliperVisuals(caliper, newCaliperWidth, interactiveHeight);
                    }
                    break;
            }
        };

        const onInteractionEnd = function(eEnd) {
            if (!isDragging) return;
            if (dragTarget && dragTarget.caliper === activeReferenceCaliper) updateAllCaliperLabels();
            isDragging = false;
            document.removeEventListener('mousemove', onInteractionMove);
            document.removeEventListener('mouseup', onInteractionEnd);
            document.removeEventListener('touchmove', onInteractionMove);
            document.removeEventListener('touchend', onInteractionEnd);
            document.removeEventListener('touchcancel', onInteractionEnd);
            dragTarget = null;
        };

        function setupCaliperInteraction(caliper) {
            const handles = caliper.querySelectorAll('.caliper-handle, .caliper-line.caliper-vertical, .caliper-line.caliper-horizontal');
            handles.forEach(handle => {
                const onInteractionStart = function(eStart) {
                    if (eStart.type === 'touchstart' && eStart.touches.length > 1) return;
                    // eStart.preventDefault(); // Helps prevent default browser actions like text selection or "ghost clicks"

                    isDragging = true;
                    dragTarget = {
                        caliper: caliper, handle: handle, type: handle.dataset.type,
                        initialCaliperLeft: parseFloat(caliper.style.left || 0),
                        initialCaliperWidth: parseFloat(caliper.dataset.width || 0)
                    };
                    const clientX = eStart.type === 'touchstart' ? eStart.touches[0].clientX : eStart.clientX;
                    const clientY = eStart.type === 'touchstart' ? eStart.touches[0].clientY : eStart.clientY;
                    const caliperRect = caliper.getBoundingClientRect();
                    dragOffset.x = clientX - caliperRect.left;
                    dragOffset.y = clientY - caliperRect.top;

                    if (eStart.type === 'mousedown') {
                        document.addEventListener('mousemove', onInteractionMove);
                        document.addEventListener('mouseup', onInteractionEnd);
                    } else if (eStart.type === 'touchstart') {
                        document.addEventListener('touchmove', onInteractionMove, { passive: false });
                        document.addEventListener('touchend', onInteractionEnd);
                        document.addEventListener('touchcancel', onInteractionEnd);
                    }
                };
                handle.addEventListener('mousedown', onInteractionStart);
                handle.addEventListener('touchstart', onInteractionStart, { passive: false });
            });
        }

        function updateCaliperVisuals(caliper, width, interactiveHeight) {
            caliper.dataset.width = width;
            caliper.querySelector('.caliper-line.caliper-vertical[data-type="right"]').style.left = width + 'px';
            caliper.querySelector('.caliper-line.caliper-horizontal').style.width = width + 'px';
            caliper.querySelector('.caliper-line.caliper-horizontal').style.top = (interactiveHeight / 2) + 'px';
            caliper.querySelector('.caliper-handle[data-type="left-handle"]').style.top = (interactiveHeight / 2) + 'px';
            caliper.querySelector('.caliper-handle[data-type="right-handle"]').style.left = width + 'px';
            caliper.querySelector('.caliper-handle[data-type="right-handle"]').style.top = (interactiveHeight / 2) + 'px';
            caliper.querySelector('.caliper-handle[data-type="move-handle"]').style.left = (width / 2) + 'px';
            caliper.querySelector('.caliper-handle[data-type="move-handle"]').style.top = (interactiveHeight / 2) + 'px';
            caliper.querySelector('.caliper-label').style.left = (width + 10) + 'px';
            caliper.querySelector('.caliper-label').style.top = (interactiveHeight / 2 - 10) + 'px';

            if (caliper.dataset.isRhythm === "true") {
                const extensionLine = caliper.querySelector('.rhythm-extension-line');
                const extendedWidthFactor = 5; const totalExtendedWidth = width * extendedWidthFactor;
                extensionLine.style.width = totalExtendedWidth + 'px'; extensionLine.style.left = width + 'px';
                extensionLine.style.top = (interactiveHeight / 2) + 'px';
                const tickHeight = parseFloat(caliper.dataset.verticalLineRenderHeight) / 2;
                const tickTopOffset = (interactiveHeight / 2) - (tickHeight / 2);
                for (let i = 0; i < extendedWidthFactor; i++) {
                    const tick = caliper.querySelector(`.rhythm-tick-mark.tick-${i}`);
                    if (tick) {
                        tick.style.left = (width + (i * width)) + 'px';
                        tick.style.top = tickTopOffset + 'px'; tick.style.height = tickHeight + 'px';
                    }
                }
            }
            updateCaliperLabel(caliper, width);
        }
        function updateCaliperLabel(caliper, widthInPx) {
            const label = caliper.querySelector('.caliper-label'); if (!label) return;
            const isThisReference = (caliper === activeReferenceCaliper);
            const isRhythm = caliper.dataset.isRhythm === "true"; let labelText = "";
            if (isThisReference) {
                labelText = `Ref: ${currentReferenceMsSetting} ms (${Math.round(widthInPx)} px)`;
            } else {
                if (activeReferenceCaliper && currentReferenceMsSetting && activeReferenceCaliper.dataset.width) {
                    const refPixelWidth = parseFloat(activeReferenceCaliper.dataset.width);
                    if (refPixelWidth > 0) {
                        const msValue = (widthInPx * currentReferenceMsSetting) / refPixelWidth;
                        labelText = `${Math.round(msValue)} ms`;
                        if (msValue > 0) {
                             const bpmValue = 60000 / msValue; labelText += `\n${Math.round(bpmValue)} bpm`;
                        }
                    } else { labelText = `${Math.round(widthInPx)} px (Ref Err)`; }
                } else { labelText = `${Math.round(widthInPx)} px`; }
            }
            label.textContent = labelText;
        }
        function updateAllCaliperLabels() {
            document.querySelectorAll('.caliper').forEach(c => { if (c.dataset.width) updateCaliperLabel(c, parseFloat(c.dataset.width)); });
        }

        function updateReferenceValue() {
            const select = document.getElementById('referenceSelect');
            currentReferenceMsSetting = select.value ? parseFloat(select.value) : 1000; updateAllCaliperLabels();
        }
        function updateReferenceUIDisabledState() {
            const label = document.getElementById('referenceLabel'); const select = document.getElementById('referenceSelect');
            const isDisabled = !activeReferenceCaliper;
            if (label) label.style.opacity = isDisabled ? 0.6 : 1;
            if (select) { select.disabled = isDisabled; select.style.opacity = isDisabled ? 0.6 : 1; }
        }
        function removeCaliper(caliper) {
            let wasReference = false;
            if (caliper === activeReferenceCaliper) { activeReferenceCaliper = null; wasReference = true; }
            if (caliper.parentNode) caliper.remove();
            updateReferenceUIDisabledState(); if (wasReference) updateAllCaliperLabels();
        }
        function clearAllCalipers() {
            document.querySelectorAll('.caliper').forEach(c => { if (c.parentNode) c.remove(); });
            activeReferenceCaliper = null; caliperCount = 0;
            updateReferenceUIDisabledState(); updateAllCaliperLabels();
        }

        function toggleModal(modalId, show) {
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = show ? 'flex' : 'none';
        }

        document.addEventListener('dragstart', e => { if (!e.target.classList.contains('caliper-handle') && !e.target.classList.contains('caliper-line')) e.preventDefault(); });
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); handlePaste(); }
            }
            if (e.key === "Escape") { toggleModal('instructionsModal', false); }
        });
        document.addEventListener('DOMContentLoaded', () => {
            updateReferenceUIDisabledState();
            const initialSelect = document.getElementById('referenceSelect');
            if (initialSelect.value) currentReferenceMsSetting = parseFloat(initialSelect.value);
            const selectedColorOption = document.querySelector('.color-option.selected');
            if (selectedColorOption) currentColor = selectedColorOption.dataset.color;
        });
