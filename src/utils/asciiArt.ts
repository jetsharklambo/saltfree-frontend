// ASCII Art generator for game codes with 90s aesthetic
export const generateASCIIGameCode = (gameCode: string): string => {
  if (!gameCode) return '';
  
  // Simple block-style ASCII letters for game codes
  const asciiLetters: { [key: string]: string[] } = {
    'A': [
      '████',
      '█  █',
      '████', 
      '█  █',
      '█  █'
    ],
    'B': [
      '███ ',
      '█  █',
      '███ ',
      '█  █',
      '███ '
    ],
    'C': [
      '████',
      '█   ',
      '█   ',
      '█   ',
      '████'
    ],
    'D': [
      '███ ',
      '█  █',
      '█  █',
      '█  █',
      '███ '
    ],
    'E': [
      '████',
      '█   ',
      '███ ',
      '█   ',
      '████'
    ],
    'F': [
      '████',
      '█   ',
      '███ ',
      '█   ',
      '█   '
    ],
    'G': [
      '████',
      '█   ',
      '█ ██',
      '█  █',
      '████'
    ],
    'H': [
      '█  █',
      '█  █',
      '████',
      '█  █',
      '█  █'
    ],
    'I': [
      '████',
      ' ██ ',
      ' ██ ',
      ' ██ ',
      '████'
    ],
    'J': [
      '████',
      '   █',
      '   █',
      '█  █',
      '████'
    ],
    'K': [
      '█  █',
      '█ █ ',
      '██  ',
      '█ █ ',
      '█  █'
    ],
    'L': [
      '█   ',
      '█   ',
      '█   ',
      '█   ',
      '████'
    ],
    'M': [
      '█  █',
      '████',
      '████',
      '█  █',
      '█  █'
    ],
    'N': [
      '█  █',
      '██ █',
      '████',
      '█ ██',
      '█  █'
    ],
    'O': [
      '████',
      '█  █',
      '█  █',
      '█  █',
      '████'
    ],
    'P': [
      '███ ',
      '█  █',
      '███ ',
      '█   ',
      '█   '
    ],
    'Q': [
      '████',
      '█  █',
      '█  █',
      '█ ██',
      '████'
    ],
    'R': [
      '███ ',
      '█  █',
      '███ ',
      '█ █ ',
      '█  █'
    ],
    'S': [
      '████',
      '█   ',
      '████',
      '   █',
      '████'
    ],
    'T': [
      '████',
      ' ██ ',
      ' ██ ',
      ' ██ ',
      ' ██ '
    ],
    'U': [
      '█  █',
      '█  █',
      '█  █',
      '█  █',
      '████'
    ],
    'V': [
      '█  █',
      '█  █',
      '█  █',
      ' ██ ',
      ' ██ '
    ],
    'W': [
      '█  █',
      '█  █',
      '████',
      '████',
      '█  █'
    ],
    'X': [
      '█  █',
      ' ██ ',
      ' ██ ',
      ' ██ ',
      '█  █'
    ],
    'Y': [
      '█  █',
      '█  █',
      ' ██ ',
      ' ██ ',
      ' ██ '
    ],
    'Z': [
      '████',
      '   █',
      ' ██ ',
      '█   ',
      '████'
    ],
    '0': [
      '████',
      '█  █',
      '█  █',
      '█  █',
      '████'
    ],
    '1': [
      ' ██ ',
      '███ ',
      ' ██ ',
      ' ██ ',
      '████'
    ],
    '2': [
      '████',
      '   █',
      '████',
      '█   ',
      '████'
    ],
    '3': [
      '████',
      '   █',
      '████',
      '   █',
      '████'
    ],
    '4': [
      '█  █',
      '█  █',
      '████',
      '   █',
      '   █'
    ],
    '5': [
      '████',
      '█   ',
      '████',
      '   █',
      '████'
    ],
    '6': [
      '████',
      '█   ',
      '████',
      '█  █',
      '████'
    ],
    '7': [
      '████',
      '   █',
      '  ██',
      ' ██ ',
      '██  '
    ],
    '8': [
      '████',
      '█  █',
      '████',
      '█  █',
      '████'
    ],
    '9': [
      '████',
      '█  █',
      '████',
      '   █',
      '████'
    ],
    '-': [
      '    ',
      '    ',
      '████',
      '    ',
      '    '
    ],
    '_': [
      '    ',
      '    ',
      '    ',
      '    ',
      '████'
    ],
    ' ': [
      '    ',
      '    ',
      '    ',
      '    ',
      '    '
    ]
  };

  // Convert game code to uppercase and split into characters
  const characters = gameCode.toUpperCase().split('');
  
  // Handle codes longer than 6 characters by truncating
  const displayCode = characters.slice(0, 6);
  
  // Generate ASCII art lines
  const lines: string[] = ['', '', '', '', ''];
  
  displayCode.forEach((char, index) => {
    const asciiChar = asciiLetters[char] || asciiLetters[' '];
    asciiChar.forEach((line, lineIndex) => {
      lines[lineIndex] += line + (index < displayCode.length - 1 ? ' ' : '');
    });
  });
  
  return lines.join('\n');
};

// Generate seven segment display style for pager aesthetic
export const generateCompactASCII = (gameCode: string): string => {
  if (!gameCode) return '';
  
  // Seven segment display characters (like digital clock/pager)
  const displayLetters: { [key: string]: string[] } = {
    'A': [
      ' ███ ',
      '█   █',
      '█████',
      '█   █',
      '█   █'
    ],
    'B': [
      '████ ',
      '█   █',
      '████ ',
      '█   █',
      '████ '
    ],
    'C': [
      ' ████',
      '█    ',
      '█    ',
      '█    ',
      ' ████'
    ],
    'D': [
      '████ ',
      '█   █',
      '█   █',
      '█   █',
      '████ '
    ],
    'E': [
      '█████',
      '█    ',
      '████ ',
      '█    ',
      '█████'
    ],
    'F': [
      '█████',
      '█    ',
      '████ ',
      '█    ',
      '█    '
    ],
    'G': [
      ' ████',
      '█    ',
      '█ ███',
      '█   █',
      ' ████'
    ],
    'H': [
      '█   █',
      '█   █',
      '█████',
      '█   █',
      '█   █'
    ],
    'I': [
      '█████',
      '  █  ',
      '  █  ',
      '  █  ',
      '█████'
    ],
    'J': [
      '█████',
      '    █',
      '    █',
      '█   █',
      ' ███ '
    ],
    'K': [
      '█   █',
      '█  █ ',
      '███  ',
      '█  █ ',
      '█   █'
    ],
    'L': [
      '█    ',
      '█    ',
      '█    ',
      '█    ',
      '█████'
    ],
    'M': [
      '█   █',
      '██ ██',
      '█ █ █',
      '█   █',
      '█   █'
    ],
    'N': [
      '█   █',
      '██  █',
      '█ █ █',
      '█  ██',
      '█   █'
    ],
    'O': [
      ' ███ ',
      '█   █',
      '█   █',
      '█   █',
      ' ███ '
    ],
    'P': [
      '████ ',
      '█   █',
      '████ ',
      '█    ',
      '█    '
    ],
    'Q': [
      ' ███ ',
      '█   █',
      '█   █',
      '█  ██',
      ' ████'
    ],
    'R': [
      '████ ',
      '█   █',
      '████ ',
      '█  █ ',
      '█   █'
    ],
    'S': [
      ' ████',
      '█    ',
      ' ███ ',
      '    █',
      '████ '
    ],
    'T': [
      '█████',
      '  █  ',
      '  █  ',
      '  █  ',
      '  █  '
    ],
    'U': [
      '█   █',
      '█   █',
      '█   █',
      '█   █',
      ' ███ '
    ],
    'V': [
      '█   █',
      '█   █',
      '█   █',
      ' █ █ ',
      '  █  '
    ],
    'W': [
      '█   █',
      '█   █',
      '█ █ █',
      '██ ██',
      '█   █'
    ],
    'X': [
      '█   █',
      ' █ █ ',
      '  █  ',
      ' █ █ ',
      '█   █'
    ],
    'Y': [
      '█   █',
      '█   █',
      ' ███ ',
      '  █  ',
      '  █  '
    ],
    'Z': [
      '█████',
      '   █ ',
      '  █  ',
      ' █   ',
      '█████'
    ],
    '0': [
      ' ███ ',
      '█   █',
      '█   █',
      '█   █',
      ' ███ '
    ],
    '1': [
      '  █  ',
      ' ██  ',
      '  █  ',
      '  █  ',
      ' ███ '
    ],
    '2': [
      ' ███ ',
      '    █',
      ' ███ ',
      '█    ',
      '█████'
    ],
    '3': [
      '████ ',
      '    █',
      ' ███ ',
      '    █',
      '████ '
    ],
    '4': [
      '█   █',
      '█   █',
      '█████',
      '    █',
      '    █'
    ],
    '5': [
      '█████',
      '█    ',
      '████ ',
      '    █',
      '████ '
    ],
    '6': [
      ' ███ ',
      '█    ',
      '████ ',
      '█   █',
      ' ███ '
    ],
    '7': [
      '█████',
      '    █',
      '   █ ',
      '  █  ',
      ' █   '
    ],
    '8': [
      ' ███ ',
      '█   █',
      ' ███ ',
      '█   █',
      ' ███ '
    ],
    '9': [
      ' ███ ',
      '█   █',
      ' ████',
      '    █',
      ' ███ '
    ],
    '-': [
      '     ',
      '     ',
      '█████',
      '     ',
      '     '
    ],
    '_': [
      '     ',
      '     ',
      '     ',
      '     ',
      '█████'
    ],
    ' ': [
      '     ',
      '     ',
      '     ',
      '     ',
      '     '
    ]
  };

  const characters = gameCode.toUpperCase().split('').slice(0, 7);
  const lines: string[] = ['', '', '', '', ''];
  
  characters.forEach((char, index) => {
    const asciiChar = displayLetters[char] || displayLetters[' '];
    asciiChar.forEach((line, lineIndex) => {
      lines[lineIndex] += line + (index < characters.length - 1 ? '  ' : '');
    });
  });
  
  return lines.join('\n');
};

// Generate retro border frames for ASCII art
export const generateRetroFrame = (content: string, style: 'single' | 'double' | 'thick' = 'single'): string => {
  const lines = content.split('\n');
  const maxWidth = Math.max(...lines.map(line => line.length));
  
  const borders = {
    single: { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' },
    double: { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝' },
    thick: { h: '━', v: '┃', tl: '┏', tr: '┓', bl: '┗', br: '┛' }
  };
  
  const b = borders[style];
  const horizontalLine = b.h.repeat(maxWidth + 2);
  
  const framedLines = [
    b.tl + horizontalLine + b.tr,
    ...lines.map(line => b.v + ' ' + line.padEnd(maxWidth) + ' ' + b.v),
    b.bl + horizontalLine + b.br
  ];
  
  return framedLines.join('\n');
};