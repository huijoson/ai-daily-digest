// Comic-lite design tokens. Pure JS objects (RN styles are plain objects), so this
// file is unit-testable under Node and importable by the RN screens in app/.

export const colors = {
  ink: '#1a1a1a',
  paper: '#fdf6ec',
  card: '#ffffff',
  accent: '#e63946',
  muted: '#999999',
  subtle: '#555555',
} as const;

export const border = { width: 2.5, color: colors.ink } as const;
export const radii = { card: 10, pill: 20 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const shadowHard = {
  shadowColor: colors.ink,
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 6,
} as const;

export const fonts = { displayFamily: 'Bangers_400Regular' } as const;

export const type = {
  display: { fontFamily: fonts.displayFamily, fontSize: 26, letterSpacing: 1, color: colors.ink },
  title: { fontSize: 16, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 14, lineHeight: 22, color: colors.ink },
  summary: { fontSize: 12, lineHeight: 18, color: colors.subtle },
  meta: { fontSize: 10, color: colors.muted },
  section: { fontSize: 11, fontWeight: '700' as const },
} as const;

export const styles = {
  screenBg: { flex: 1, backgroundColor: colors.paper },
  comicCard: {
    backgroundColor: colors.card,
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: radii.card,
    shadowColor: shadowHard.shadowColor,
    shadowOffset: shadowHard.shadowOffset,
    shadowOpacity: shadowHard.shadowOpacity,
    shadowRadius: shadowHard.shadowRadius,
    elevation: shadowHard.elevation,
  },
  sectionPill: {
    alignSelf: 'flex-start' as const,
    backgroundColor: colors.ink,
    color: colors.paper,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 3,
    overflow: 'hidden' as const,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  comicButton: {
    backgroundColor: colors.accent,
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: radii.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: shadowHard.shadowColor,
    shadowOffset: shadowHard.shadowOffset,
    shadowOpacity: shadowHard.shadowOpacity,
    shadowRadius: shadowHard.shadowRadius,
    elevation: shadowHard.elevation,
  },
  comicButtonText: { color: colors.card, fontWeight: '700' as const, textAlign: 'center' as const },
  headerTitle: { fontFamily: fonts.displayFamily, fontSize: 26, color: colors.ink, letterSpacing: 1 },
} as const;
