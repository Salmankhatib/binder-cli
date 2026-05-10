import pc from "picocolors";

export const logo = `
╔═════════════════════════════════════════════════════╗
║                                                     ║
║    ██████╗ ██╗███╗   ██╗██████╗ ███████╗██████╗     ║
║    ██╔══██╗██║████╗  ██║██╔══██╗██╔════╝██╔══██╗    ║
║    ██████╔╝██║██╔██╗ ██║██║  ██║█████╗  ██████╔╝    ║
║    ██╔══██╗██║██║╚██╗██║██║  ██║██╔══╝  ██╔══██╗    ║
║    ██████╔╝██║██║ ╚████║██████╔╝███████╗██║  ██║    ║
║    ╚═════╝ ╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═     ║
║                                                     ║
║       v0.1.7  //  MOCK-TO-API BINDING ENGINE        ║
╚═════════════════════════════════════════════════════╝
`;

export const revealLogo = async () => {
  const lines = logo.split('\n');
  for (const line of lines) {
    console.log(pc.cyan(line));
    await new Promise(r => setTimeout(r, 30));
  }
  console.log(pc.gray(divider));
};

export const divider = '─'.repeat(60);

export const statusIcons = {
  init:    '[INIT]',
  system:  '[SYS]',
  engine:  '[ENGINE]',
  network: '[NET]',
  io:      '[IO]',
  done:    '[OK]',
  warn:    '[WARN]',
  fail:    '[FAIL]',
};