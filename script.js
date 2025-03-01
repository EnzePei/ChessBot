document.addEventListener('DOMContentLoaded', () => {
    const chessBoard = document.getElementById('chessBoard');
    const turnIndicator = document.getElementById('turnIndicator');
    const capturedByWhite = document.getElementById('capturedByWhite');
    const capturedByBlack = document.getElementById('capturedByBlack');
    const moveHistory = document.getElementById('moveHistory');
    const resetButton = document.getElementById('resetButton');
    const undoButton = document.getElementById('undoButton');
    const promotionModal = document.getElementById('promotionModal');
    const promotionOptions = document.getElementById('promotionOptions');
    const gameStatus = document.getElementById('gameStatus');
    const statusMessage = document.getElementById('statusMessage');
    const newGameButton = document.getElementById('newGameButton');

    // -------------------- ADDITION #1: Difficulty Slider --------------------
    // Create a container + label + range input to adjust AI strength
    const difficultyContainer = document.createElement('div');
    difficultyContainer.style.display = 'flex';
    difficultyContainer.style.alignItems = 'center';
    difficultyContainer.style.marginTop = '10px';

    const difficultyLabel = document.createElement('label');
    difficultyLabel.textContent = 'AI Strength:';
    difficultyLabel.style.marginRight = '8px';
    difficultyLabel.style.fontFamily = 'Cinzel, serif';
    difficultyLabel.style.letterSpacing = '1px';
    difficultyLabel.style.textTransform = 'uppercase';

    const difficultySlider = document.createElement('input');
    difficultySlider.type = 'range';
    difficultySlider.min = '1';
    difficultySlider.max = '10';
    difficultySlider.value = '3'; // default difficulty
    difficultySlider.id = 'difficultySlider';
    difficultySlider.style.appearance = 'none';
    difficultySlider.style.width = '120px';
    difficultySlider.style.height = '6px';
    difficultySlider.style.borderRadius = '4px';
    difficultySlider.style.background = 'linear-gradient(145deg, #34404c, #1e293b)';
    difficultySlider.style.outline = 'none';
    difficultySlider.style.cursor = 'pointer';
    difficultySlider.style.boxShadow = 'inset 0 0 8px rgba(0,0,0,0.3)';
    difficultySlider.style.border = '1px solid rgba(210, 180, 140, 0.4)';
    
    const difficultyValueSpan = document.createElement('span');
    difficultyValueSpan.style.marginLeft = '8px';
    difficultyValueSpan.textContent = difficultySlider.value;

    // Insert slider near the undo button or similar
    const buttonContainer = undoButton.parentNode;
    buttonContainer.appendChild(difficultyContainer);
    difficultyContainer.appendChild(difficultyLabel);
    difficultyContainer.appendChild(difficultySlider);
    difficultyContainer.appendChild(difficultyValueSpan);

    // We'll map difficulty to depth + time
    let MAX_DEPTH = 3;         // Will be set by slider
    let TIME_LIMIT_MS = 1500;  // Will be set by slider

    difficultySlider.addEventListener('input', () => {
      const val = parseInt(difficultySlider.value, 10);
      difficultyValueSpan.textContent = val.toString();

      // For a difficulty range [1..10], let's do:
      // Depth = val + 2 (min 3, max 12)
      // Time limit = 1 second + 0.3 * val => (1300 to 4000ms)
      MAX_DEPTH = val + 2;
      TIME_LIMIT_MS = 1000 + 300 * val;
    });
    // -----------------------------------------------------------------------

    // -------------------- White/Black AI Toggles (Optional) ----------------
    // Example: White is human, Black is AI by default
    let isWhiteAI = false;
    let isBlackAI = true;
    const whiteModeButton = document.createElement('button');
    whiteModeButton.textContent = 'White: Human'; 
    whiteModeButton.style.marginLeft = '8px';

    const blackModeButton = document.createElement('button');
    blackModeButton.textContent = 'Black: AI'; 
    blackModeButton.style.marginLeft = '8px';

    whiteModeButton.addEventListener('click', () => {
      isWhiteAI = !isWhiteAI; 
      whiteModeButton.textContent = isWhiteAI ? 'White: AI' : 'White: Human';
      if (currentPlayer === 'white' && isWhiteAI) {
        setTimeout(aiMove, 200);
      }
    });
    blackModeButton.addEventListener('click', () => {
      isBlackAI = !isBlackAI;
      blackModeButton.textContent = isBlackAI ? 'Black: AI' : 'Black: Human';
      if (currentPlayer === 'black' && isBlackAI) {
        setTimeout(aiMove, 200);
      }
    });
    buttonContainer.appendChild(whiteModeButton);
    buttonContainer.appendChild(blackModeButton);
    // -----------------------------------------------------------------------

    // ---------- Game Variables ----------
    let boardState = [];
    let capturedPieces = { white: [], black: [] };
    let moveHistoryList = [];
    let gameHistory = [];
    let selectedPiece = null;
    let currentPlayer = 'white';
    let enPassantTarget = null; // { row, col } or null

    // Mapping pieces to their Unicode icons.
    const pieceMap = {
      'p': '♙','r': '♖','n': '♘','b': '♗','q': '♕','k': '♔',
      'P': '♟','R': '♜','N': '♞','B': '♝','Q': '♛','K': '♚'
    };

    // ----- Piece Values & Piece-Square Tables for Smarter AI -----
    // We'll combine basic material + PST for each piece
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 999 };

    // Example PST for pawns, knights, bishops, rooks, queens
    // White perspective; for black, we mirror.
    const pawnPST = [
      [  0,   0,   0,   0,   0,   0,   0,   0 ],
      [  5,   5,   5,  -5,  -5,   5,   5,   5 ],
      [  1,   1,   2,   3,   3,   2,   1,   1 ],
      [0.5,0.5,  1,  2.5, 2.5,  1,0.5, 0.5 ],
      [  0,   0,   0,   2,   2,   0,   0,   0 ],
      [0.5,-0.5,-1,   0,   0,  -1,-0.5,0.5 ],
      [0.5,  1,   1,  -2,  -2,   1,   1,0.5 ],
      [  0,   0,   0,   0,   0,   0,   0,   0 ]
    ];
    const knightPST = [
      [-5, -4, -3, -3, -3, -3, -4, -5 ],
      [-4, -2,  0,  0,  0,  0, -2, -4 ],
      [-3,  0,  1,1.5,1.5,  1,  0, -3 ],
      [-3,0.5,1.5,  2,  2,1.5,0.5, -3 ],
      [-3,  0,1.5,  2,  2,1.5,  0, -3 ],
      [-3,0.5,  1,1.5,1.5,  1,0.5, -3 ],
      [-4, -2,  0,  0,  0,  0, -2, -4 ],
      [-5, -4, -3, -3, -3, -3, -4, -5 ]
    ];
    const bishopPST = [
      [ -2, -1, -1, -1, -1, -1, -1, -2 ],
      [ -1,  0,  0,  0,  0,  0,  0, -1 ],
      [ -1,  0,  0.5,1, 1,  0.5,  0, -1 ],
      [ -1,  0.5,1,  1.5,1.5,1,  0.5, -1 ],
      [ -1,  0,   1,  1.5,1.5,1,  0,   -1 ],
      [ -1,  0.5,0.5, 1,  1,  0.5,0.5, -1 ],
      [ -1,  0,   0.5, 0,  0,  0.5,  0, -1 ],
      [ -2, -1, -1, -1, -1, -1, -1, -2 ]
    ];
    const rookPST = [
      [  0,   0,   0,   0,   0,   0,   0,   0 ],
      [ 0.5, 1,   1,   1,   1,   1,   1, 0.5 ],
      [ -0.5, 0,  0,   0,   0,   0,   0, -0.5 ],
      [ -0.5, 0,  0,   0,   0,   0,   0, -0.5 ],
      [ -0.5, 0,  0,   0,   0,   0,   0, -0.5 ],
      [ -0.5, 0,  0,   0,   0,   0,   0, -0.5 ],
      [ -0.5, 0,  0,   0,   0,   0,   0, -0.5 ],
      [  0,   0,   0, 0.5, 0.5,   0,   0,  0 ]
    ];
    const queenPST = [
      [ -2, -1, -1, -0.5,-0.5, -1, -1, -2 ],
      [ -1,  0,   0,   0,   0,   0,   0,  -1 ],
      [ -1,  0,   0.5, 0.5, 0.5,  0.5,  0, -1 ],
      [ -0.5, 0,  0.5, 0.5, 0.5,  0.5,  0, -0.5 ],
      [ -0.5, 0,  0.5, 0.5, 0.5,  0.5,  0, -0.5 ],
      [ -1,  0.5, 0.5, 0.5, 0.5,  0.5,  0, -1 ],
      [ -1,  0,   0.5, 0,   0,   0,   0, -1 ],
      [ -2, -1, -1, -0.5,-0.5, -1, -1, -2 ]
    ];

    // Return piece-square bonus for the piece at row,col
    function getPSTBonus(piece, row, col) {
      const lower = piece.toLowerCase();
      const mirrorRow = 7 - row; // for black
      if (lower === 'p') {
        return (piece === piece.toUpperCase()) ? pawnPST[mirrorRow][col] : -pawnPST[row][col];
      }
      if (lower === 'n') {
        return (piece === piece.toUpperCase()) ? knightPST[mirrorRow][col] : -knightPST[row][col];
      }
      if (lower === 'b') {
        return (piece === piece.toUpperCase()) ? bishopPST[mirrorRow][col] : -bishopPST[row][col];
      }
      if (lower === 'r') {
        return (piece === piece.toUpperCase()) ? rookPST[mirrorRow][col] : -rookPST[row][col];
      }
      if (lower === 'q') {
        return (piece === piece.toUpperCase()) ? queenPST[mirrorRow][col] : -queenPST[row][col];
      }
      return 0; // no PST for king right now
    }

    // -------------- INIT & RENDER --------------
    function renderPiece(piece) {
      let classes = 'piece ';
      if (piece.toLowerCase() === 'p') {
        classes += (piece === piece.toLowerCase()) ? 'white-piece white-pawn' : 'black-piece black-pawn';
      } else {
        classes += (piece === piece.toLowerCase()) ? 'white-piece' : 'black-piece';
      }
      return `<span class="${classes}">${pieceMap[piece]}</span>`;
    }

    function initializeBoard() {
      chessBoard.innerHTML = '';
      boardState = [];
      capturedPieces = { white: [], black: [] };
      moveHistoryList = [];
      gameHistory = [];
      selectedPiece = null;
      currentPlayer = 'white';
      enPassantTarget = null;
      turnIndicator.textContent = "White's Turn";
      capturedByWhite.innerHTML = '';
      capturedByBlack.innerHTML = '';
      moveHistory.innerHTML = '';
      gameStatus.style.display = 'none';

      const initialSetup = [
        ['R','N','B','Q','K','B','N','R'],
        ['P','P','P','P','P','P','P','P'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['p','p','p','p','p','p','p','p'],
        ['r','n','b','q','k','b','n','r']
      ];

      for (let row = 0; row < 8; row++) {
        let boardRow = [];
        for (let col = 0; col < 8; col++) {
          let square = document.createElement('div');
          square.className = `square ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
          square.dataset.row = row;
          square.dataset.col = col;
          square.addEventListener('click', handleSquareClick);

          let piece = initialSetup[row][col];
          if (piece) {
            square.innerHTML = renderPiece(piece);
            square.dataset.piece = piece;
          }
          chessBoard.appendChild(square);
          boardRow.push(piece);
        }
        boardState.push(boardRow);
      }
      updateCurrentPlayerHighlight();
    }

    // -------------- EVENT LISTENERS --------------
    resetButton.addEventListener('click', initializeBoard);
    undoButton.addEventListener('click', undoMove);
    newGameButton.addEventListener('click', () => {
      gameStatus.style.display = 'none';
      initializeBoard();
    });

    // -------------- SELECTORS / HIGHLIGHTS / MOVES --------------
    function clearSelectionHighlight() {
      document.querySelectorAll('.square').forEach(sq => sq.classList.remove('selected'));
    }
    function clearValidMoveHighlights() {
      document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('valid-move-white');
        sq.classList.remove('valid-move-black');
      });
    }
    function updateCurrentPlayerHighlight() {
      document.querySelectorAll('.square').forEach(square => {
        if (square.dataset.piece) {
          const piece = square.dataset.piece;
          if (currentPlayer === 'white' && piece === piece.toLowerCase()) {
            square.classList.add('current-player');
          } else if (currentPlayer === 'black' && piece === piece.toUpperCase()) {
            square.classList.add('current-player');
          } else {
            square.classList.remove('current-player');
          }
        } else {
          square.classList.remove('current-player');
        }
      });
    }
    function handleSquareClick(event) {
      if ((currentPlayer === 'white' && isWhiteAI) ||
          (currentPlayer === 'black' && isBlackAI)) {
        return;
      }
      const square = event.currentTarget;
      const row = parseInt(square.dataset.row);
      const col = parseInt(square.dataset.col);

      if (selectedPiece) {
        if (row === selectedPiece.row && col === selectedPiece.col) {
          clearSelectionHighlight();
          clearValidMoveHighlights();
          selectedPiece = null;
          return;
        }
        if (square.classList.contains('valid-move-white') || square.classList.contains('valid-move-black')) {
          movePiece(selectedPiece.row, selectedPiece.col, row, col);
        }
        clearSelectionHighlight();
        clearValidMoveHighlights();
        selectedPiece = null;
      } else {
        if (square.dataset.piece) {
          const piece = square.dataset.piece;
          if ((currentPlayer === 'white' && piece === piece.toLowerCase()) ||
              (currentPlayer === 'black' && piece === piece.toUpperCase())) {
            clearSelectionHighlight();
            clearValidMoveHighlights();
            selectedPiece = { row, col };
            square.classList.add('selected');
            highlightValidMoves(row, col);
          }
        }
      }
    }
    function highlightValidMoves(row, col) {
      clearValidMoveHighlights();
      const selectedPieceValue = boardState[row][col];
      const isWhiteSelected = (selectedPieceValue === selectedPieceValue.toLowerCase());
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (r === row && c === col) continue;
          if (isMoveLegal(row, col, r, c) && doesNotExposeKing(row, col, r, c)) {
            let sq = getSquare(r, c);
            if (sq) {
              if (isWhiteSelected) sq.classList.add('valid-move-white');
              else sq.classList.add('valid-move-black');
            }
          }
        }
      }
    }

    // -------------- MAIN MOVE LOGIC --------------
    function movePiece(fromRow, fromCol, toRow, toCol) {
      const fromSquare = getSquare(fromRow, fromCol);
      const toSquare = getSquare(toRow, toCol);
      if (!fromSquare || !toSquare || !fromSquare.dataset.piece) return;

      if (!isMoveLegal(fromRow, fromCol, toRow, toCol) || !doesNotExposeKing(fromRow, fromCol, toRow, toCol)) {
        return;
      }

      saveGameState();

      const movingPiece = fromSquare.dataset.piece;
      const isPawn = (movingPiece.toLowerCase() === 'p');
      let enPassantCapture = false;
      if (isPawn && Math.abs(toCol - fromCol) === 1 &&
          (!toSquare.dataset.piece || toSquare.dataset.piece === '')) {
        if (enPassantTarget && enPassantTarget.row === toRow && enPassantTarget.col === toCol) {
          enPassantCapture = true;
        }
      }

      // Normal capture
      if (toSquare.dataset.piece) {
        capturedPieces[currentPlayer].push(toSquare.dataset.piece);
        updateCapturedPieces();
      }

      // En passant
      if (enPassantCapture) {
        let captureRow = (movingPiece === movingPiece.toLowerCase()) ? toRow + 1 : toRow - 1;
        let captureSquare = getSquare(captureRow, toCol);
        if (captureSquare && captureSquare.dataset.piece) {
          capturedPieces[currentPlayer].push(captureSquare.dataset.piece);
          updateCapturedPieces();
          captureSquare.textContent = '';
          delete captureSquare.dataset.piece;
          boardState[captureRow][toCol] = null;
        }
      }

      // DOM updates
      toSquare.innerHTML = renderPiece(movingPiece);
      toSquare.dataset.piece = movingPiece;
      fromSquare.textContent = '';
      delete fromSquare.dataset.piece;
      boardState[toRow][toCol] = movingPiece;
      boardState[fromRow][fromCol] = null;

      // Pawn double-step => en passant
      if (isPawn && Math.abs(toRow - fromRow) === 2) {
        enPassantTarget = { row: (fromRow + toRow)/2, col: fromCol };
      } else {
        enPassantTarget = null;
      }

      recordMove(fromRow, fromCol, toRow, toCol);

      // Pawn promotion
      if ((movingPiece === 'p' && toRow === 0) || (movingPiece === 'P' && toRow === 7)) {
        showPromotionOptions(
          movingPiece === 'p' ? 'white' : 'black',
          toRow,
          toCol,
          (newPiece) => {
            boardState[toRow][toCol] = newPiece;
            toSquare.innerHTML = renderPiece(newPiece);
            toSquare.dataset.piece = newPiece;
            currentPlayer = (currentPlayer === 'white') ? 'black' : 'white';
            turnIndicator.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1) + "'s Turn";
            updateCurrentPlayerHighlight();
            checkGameStatus();
            // If new side is AI
            if ((currentPlayer === 'white' && isWhiteAI) ||
                (currentPlayer === 'black' && isBlackAI)) {
              setTimeout(aiMove, 200);
            }
          }
        );
        return;
      }

      // Switch turn
      currentPlayer = (currentPlayer === 'white') ? 'black' : 'white';
      turnIndicator.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1) + "'s Turn";
      updateCurrentPlayerHighlight();
      checkGameStatus();

      // If new side is AI
      if ((currentPlayer === 'white' && isWhiteAI) ||
          (currentPlayer === 'black' && isBlackAI)) {
        setTimeout(aiMove, 200);
      }
    }

    // -------------- SELECTORS / HISTORY --------------
    function getSquare(row, col) {
      return chessBoard.querySelector(`[data-row='${row}'][data-col='${col}']`);
    }

    function saveGameState() {
      gameHistory.push({
        boardState: JSON.parse(JSON.stringify(boardState)),
        capturedPieces: JSON.parse(JSON.stringify(capturedPieces)),
        moveHistoryList: [...moveHistoryList],
        currentPlayer: currentPlayer,
        enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null
      });
    }

    function undoMove() {
      if (gameHistory.length === 0) return;
      const previousState = gameHistory.pop();
      boardState = previousState.boardState;
      capturedPieces = previousState.capturedPieces;
      moveHistoryList = previousState.moveHistoryList;
      currentPlayer = previousState.currentPlayer;
      enPassantTarget = previousState.enPassantTarget;
      updateBoardVisual();
      updateCapturedPieces();
      updateMoveHistoryDisplay();
      turnIndicator.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1) + "'s Turn";
      updateCurrentPlayerHighlight();
    }

    function updateBoardVisual() {
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const square = getSquare(row, col);
          const piece = boardState[row][col];
          square.innerHTML = piece ? renderPiece(piece) : '';
          if (piece) {
            square.dataset.piece = piece;
          } else {
            delete square.dataset.piece;
          }
        }
      }
    }

    function recordMove(fromRow, fromCol, toRow, toCol) {
      const moveText = `${String.fromCharCode(97 + fromCol)}${8 - fromRow} → ${String.fromCharCode(97 + toCol)}${8 - toRow}`;
      moveHistoryList.push(moveText);
      updateMoveHistoryDisplay();
    }

    function updateMoveHistoryDisplay() {
      moveHistory.innerHTML = '';
      moveHistoryList.forEach(move => {
        const moveEntry = document.createElement('div');
        moveEntry.textContent = move;
        moveHistory.appendChild(moveEntry);
      });
      moveHistory.scrollTop = moveHistory.scrollHeight;
    }

    function updateCapturedPieces() {
      capturedByWhite.innerHTML = capturedPieces.white.map(p => pieceMap[p]).join(' ');
      capturedByBlack.innerHTML = capturedPieces.black.map(p => pieceMap[p]).join(' ');
    }

    // -------------- RULE CHECKS --------------
    function isPathClear(fromRow, fromCol, toRow, toCol) {
      let rowStep = (toRow > fromRow) ? 1 : (toRow < fromRow ? -1 : 0);
      let colStep = (toCol > fromCol) ? 1 : (toCol < fromCol ? -1 : 0);
      let r = fromRow + rowStep;
      let c = fromCol + colStep;
      while (r !== toRow || c !== toCol) {
        if (boardState[r][c] !== null) return false;
        r += rowStep;
        c += colStep;
      }
      return true;
    }

    function isMoveLegal(fromRow, fromCol, toRow, toCol) {
      const piece = boardState[fromRow][fromCol];
      if (!piece) return false;
      const targetPiece = boardState[toRow][toCol];
      const isWhite = (piece === piece.toLowerCase());
      if (targetPiece) {
        const targetIsWhite = (targetPiece === targetPiece.toLowerCase());
        if (isWhite === targetIsWhite) return false;
      }
      const rowDiff = toRow - fromRow;
      const colDiff = toCol - fromCol;
      switch (piece.toLowerCase()) {
        case 'p': {
          const direction = isWhite ? -1 : 1;
          if (colDiff === 0) {
            if (rowDiff === direction && !targetPiece) return true;
            const startRow = isWhite ? 6 : 1;
            if (fromRow === startRow && rowDiff === 2*direction &&
                !boardState[fromRow + direction][fromCol] && !targetPiece) {
              return true;
            }
          } else if (Math.abs(colDiff) === 1 && rowDiff === direction) {
            if (targetPiece) return true;
            if (!targetPiece && enPassantTarget &&
                enPassantTarget.row === toRow && enPassantTarget.col === toCol) {
              return true;
            }
          }
          return false;
        }
        case 'r': {
          if (rowDiff !== 0 && colDiff !== 0) return false;
          return isPathClear(fromRow, fromCol, toRow, toCol);
        }
        case 'n': {
          if ((Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
              (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2)) {
            return true;
          }
          return false;
        }
        case 'b': {
          if (Math.abs(rowDiff) !== Math.abs(colDiff)) return false;
          return isPathClear(fromRow, fromCol, toRow, toCol);
        }
        case 'q': {
          if (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff)) {
            return isPathClear(fromRow, fromCol, toRow, toCol);
          }
          return false;
        }
        case 'k': {
          if (Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1) return true;
          return false;
        }
        default:
          return false;
      }
    }

    function showPromotionOptions(pieceColor, row, col, callback) {
      promotionOptions.innerHTML = '';
      let options = (pieceColor === 'white') ? ['q','r','b','n'] : ['Q','R','B','N'];
      options.forEach(opt => {
        let optionDiv = document.createElement('div');
        optionDiv.className = 'promotion-option';
        optionDiv.textContent = pieceMap[opt];
        optionDiv.dataset.piece = opt;
        optionDiv.addEventListener('click', () => {
          promotionModal.style.display = 'none';
          callback(opt);
        });
        promotionOptions.appendChild(optionDiv);
      });
      promotionModal.style.display = 'flex';
    }

    function findKingPosition(color) {
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          let piece = boardState[row][col];
          if (!piece) continue;
          if (color === 'white' && piece === 'k') return { row, col };
          if (color === 'black' && piece === 'K') return { row, col };
        }
      }
      return null;
    }

    function isKingInCheck(color) {
      const kingPos = findKingPosition(color);
      if (!kingPos) return false;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          let piece = boardState[row][col];
          if (!piece) continue;
          const pieceColor = (piece === piece.toLowerCase()) ? 'white' : 'black';
          if (pieceColor !== color) {
            if (isMoveLegal(row, col, kingPos.row, kingPos.col)) return true;
          }
        }
      }
      return false;
    }

    function doesNotExposeKing(fromRow, fromCol, toRow, toCol) {
      const backup = JSON.parse(JSON.stringify(boardState));
      const backupEnPassant = enPassantTarget ? { ...enPassantTarget } : null;
      const movingPiece = boardState[fromRow][fromCol];
      boardState[toRow][toCol] = movingPiece;
      boardState[fromRow][fromCol] = null;
      const kingSafe = !isKingInCheck(movingPiece === movingPiece.toLowerCase() ? 'white' : 'black');
      boardState = backup;
      enPassantTarget = backupEnPassant;
      return kingSafe;
    }

    // ---------- ADDITION #2: More accurate draw mechanism -----------
    // Check for insufficient material
    function isInsufficientMaterial() {
      // If only kings left, or only kings + single bishop/knight => draw
      // We'll do a simple check: if neither side has major pieces left, except possibly 1 minor
      let wMinor = 0, wMajor = 0;
      let bMinor = 0, bMajor = 0;

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = boardState[row][col];
          if (!piece) continue;
          const lower = piece.toLowerCase();
          const isWhitePiece = (piece === piece.toLowerCase());

          // skip kings
          if (lower === 'k') continue;

          // is it a major piece? (queen or rook)
          if (lower === 'q' || lower === 'r') {
            if (isWhitePiece) wMajor++;
            else bMajor++;
          } else if (lower === 'b' || lower === 'n') {
            // minor piece
            if (isWhitePiece) wMinor++;
            else bMinor++;
          } else if (lower === 'p') {
            // if any pawns on board => not insufficient
            return false;
          }
        }
      }

      // If either side has a major piece => not insufficient
      if (wMajor > 0 || bMajor > 0) return false;
      // If more than 1 minor piece on either side => not insufficient
      if (wMinor > 1 || bMinor > 1) return false;

      // otherwise, it's insufficient
      return true;
    }
    // ---------------------------------------------------------------

    function hasLegalMoves(color) {
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          let piece = boardState[row][col];
          if (!piece) continue;
          let pieceColor = (piece === piece.toLowerCase()) ? 'white' : 'black';
          if (pieceColor !== color) continue;
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              if (isMoveLegal(row, col, r, c) && doesNotExposeKing(row, col, r, c)) {
                return true;
              }
            }
          }
        }
      }
      return false;
    }

    function checkGameStatus() {
      // If insufficient material => immediate draw
      if (isInsufficientMaterial()) {
        gameStatus.style.display = 'flex';
        statusMessage.textContent = 'Draw by insufficient material!';
        return;
      }

      // If no legal moves => checkmate or stalemate
      if (!hasLegalMoves(currentPlayer)) {
        if (isKingInCheck(currentPlayer)) {
          gameStatus.style.display = 'flex';
          statusMessage.textContent = (currentPlayer === 'white')
            ? 'White is checkmated. Black wins!'
            : 'Black is checkmated. White wins!';
        } else {
          gameStatus.style.display = 'flex';
          statusMessage.textContent = 'Stalemate! The game is a draw.';
        }
      }
    }

    // -------------- AI Implementation (Iterative Deepening + PST + random tie-break) --------------
    function aiMove() {
      // If not actually an AI side or game ended
      if ((currentPlayer === 'white' && !isWhiteAI) ||
          (currentPlayer === 'black' && !isBlackAI)) {
        return;
      }

      const startTime = performance.now();
      let bestMove = null;
      let bestEval = -Infinity;

      for (let depth = 1; depth <= MAX_DEPTH; depth++) {
        if ((performance.now() - startTime) > TIME_LIMIT_MS) break;
        const result = alphaBetaRoot(depth, startTime, currentPlayer);
        if (result) {
          bestMove = result.move;
          bestEval = result.eval;
        }
      }

      if (bestMove) {
        movePiece(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol);
      }
    }

    // Root search with random tie-breaking
    function alphaBetaRoot(depth, startTime, color) {
      let bestVal = -Infinity;
      let bestMoves = [];

      const moves = allMovesForColor(color);
      for (let move of moves) {
        if ((performance.now() - startTime) > TIME_LIMIT_MS) break;
        const backupData = makeMoveForSearch(move);
        const val = alphaBeta(depth - 1, -Infinity, Infinity, false, startTime, switchColor(color));
        undoMoveForSearch(move, backupData);

        if (val > bestVal) {
          bestVal = val;
          bestMoves = [ move ];
        } else if (val === bestVal) {
          bestMoves.push(move);
        }
      }

      if (bestMoves.length === 0) return null;
      const chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
      return { move: chosenMove, eval: bestVal };
    }

    function alphaBeta(depth, alpha, beta, maximizing, startTime, color) {
      // Time check or depth check
      if ((performance.now() - startTime) > TIME_LIMIT_MS || depth === 0 || isTerminal()) {
        return evaluateBoard();
      }

      if (maximizing) {
        let maxEval = -Infinity;
        const moves = allMovesForColor(color);
        for (let move of moves) {
          if ((performance.now() - startTime) > TIME_LIMIT_MS) break;
          const backupData = makeMoveForSearch(move);
          const val = alphaBeta(depth - 1, alpha, beta, false, startTime, switchColor(color));
          undoMoveForSearch(move, backupData);
          maxEval = Math.max(maxEval, val);
          alpha = Math.max(alpha, val);
          if (beta <= alpha) break;
        }
        return maxEval;
      } else {
        let minEval = Infinity;
        const moves = allMovesForColor(color);
        for (let move of moves) {
          if ((performance.now() - startTime) > TIME_LIMIT_MS) break;
          const backupData = makeMoveForSearch(move);
          const val = alphaBeta(depth - 1, alpha, beta, true, startTime, switchColor(color));
          undoMoveForSearch(move, backupData);
          minEval = Math.min(minEval, val);
          beta = Math.min(beta, val);
          if (beta <= alpha) break;
        }
        return minEval;
      }
    }

    function isTerminal() {
      return (!hasLegalMoves('white') || !hasLegalMoves('black'));
    }

    // Evaluate board from black's perspective (including piece-square tables)
    function evaluateBoard() {
      let score = 0;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = boardState[r][c];
          if (!piece) continue;
          const lower = piece.toLowerCase();
          const val = pieceValues[lower] || 0;
          // black => uppercase => positive
          if (piece === piece.toUpperCase()) score += val;
          else score -= val;

          // Add PST bonus
          score += getPSTBonus(piece, r, c);
        }
      }
      return score;
    }

    // Make/undo in boardState for AI search only (no DOM updates)
    function makeMoveForSearch(move) {
      const fromPiece = boardState[move.fromRow][move.fromCol];
      const toPiece = boardState[move.toRow][move.toCol];
      const oldEnPassant = enPassantTarget ? { ...enPassantTarget } : null;

      let isPawn = fromPiece && (fromPiece.toLowerCase() === 'p');
      let wasEnPassantCapture = false;
      if (isPawn && Math.abs(move.toCol - move.fromCol) === 1 && !toPiece) {
        if (enPassantTarget && enPassantTarget.row === move.toRow && enPassantTarget.col === move.toCol) {
          wasEnPassantCapture = true;
        }
      }

      boardState[move.fromRow][move.fromCol] = null;
      boardState[move.toRow][move.toCol] = fromPiece;

      let capturedEP = null;
      if (wasEnPassantCapture) {
        const captureRow = (fromPiece === fromPiece.toLowerCase()) ? move.toRow + 1 : move.toRow - 1;
        capturedEP = boardState[captureRow][move.toCol];
        boardState[captureRow][move.toCol] = null;
      }

      if (isPawn && Math.abs(move.toRow - move.fromRow) === 2) {
        enPassantTarget = { row: (move.fromRow + move.toRow)/2, col: move.fromCol };
      } else {
        enPassantTarget = null;
      }

      return {
        fromPiece, toPiece, oldEnPassant,
        wasEnPassantCapture, capturedEP
      };
    }
    function undoMoveForSearch(move, backup) {
      boardState[move.toRow][move.toCol] = backup.toPiece;
      boardState[move.fromRow][move.fromCol] = backup.fromPiece;
      enPassantTarget = backup.oldEnPassant;

      if (backup.wasEnPassantCapture && backup.capturedEP) {
        const captureRow = (backup.fromPiece === backup.fromPiece.toLowerCase())
          ? move.toRow + 1
          : move.toRow - 1;
        boardState[captureRow][move.toCol] = backup.capturedEP;
      }
    }
    function allMovesForColor(color) {
      let moves = [];
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = boardState[row][col];
          if (!piece) continue;
          const pieceColor = (piece === piece.toLowerCase()) ? 'white' : 'black';
          if (pieceColor !== color) continue;
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              if (isMoveLegal(row, col, r, c) && doesNotExposeKing(row, col, r, c)) {
                moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c });
              }
            }
          }
        }
      }
      return moves;
    }
    function switchColor(color) {
      return (color === 'white') ? 'black' : 'white';
    }

    // Initialize everything
    initializeBoard();
});
