export type Locale = "nl" | "en";

export function detectLanguage(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.trim().toLowerCase().split(/[-_]/)[0];
    if (base === "nl" || base === "en") return base;
  }
  return "nl";
}

export function resolveLanguage(saved: string | null, languages: readonly string[]): Locale {
  return saved === "nl" || saved === "en" ? saved : detectLanguage(languages);
}

export const dutch = {
  "Your language choice could not be saved on this device.":
    "Je taalkeuze kon niet op dit apparaat worden opgeslagen.",
  "Done editing": "Klaar met bewerken",
  "Edit players": "Spelers bewerken",
  "Edit setlist": "Setlist bewerken",
  "Edit preferences": "Voorkeuren bewerken",
  "Edit assignments": "Verdeling bewerken",
  "No players assigned": "Geen spelers toegewezen",
  "No preferences yet": "Nog geen voorkeuren",
  "Edit details": "Gegevens bewerken",
  "Add floorplan": "Podiumplan toevoegen",
  "Edit floorplan": "Podiumplan bewerken",
  "Changes arrived while this form was open. Cancel and reopen it to load the latest details.":
    "Er zijn wijzigingen binnengekomen. Annuleer en open het formulier opnieuw om de nieuwste gegevens te laden.",
  "Settings menu": "Instellingenmenu",
  Settings: "Instellingen",
  Theme: "Thema",
  "Concert sections": "Concertonderdelen",
  "Swipe to see more sections →": "Veeg voor meer onderdelen →",
  "Your group.": "Jouw groep.",
  "Let’s create your group": "Maak je groep aan",
  "Group name": "Groepsnaam",
  "Your orchestra or ensemble": "Je orkest of ensemble",
  "Create group": "Groep aanmaken",
  "Your recent groups": "Jouw groepen",
  "← Back to home": "← Terug naar de startpagina",
  "Create a group, or open a group link you received.":
    "Maak een groep aan of open een ontvangen groepslink.",
  "Open group →": "Groep openen →",
  "Earlier concert shortcuts": "Eerdere concertsnelkoppelingen",
  "These older concerts remain accessible with their original links.":
    "Deze eerdere concerten blijven bereikbaar via hun oorspronkelijke links.",
  "Group workspace": "Groepsomgeving",
  "Group players": "Groepsspelers",
  "Group player": "Groepsspeler",
  "Concert guest": "Gastspeler",
  "Add concert guest": "Gastspeler toevoegen",
  "Group players are managed in the group. Add guests for this concert here.":
    "Groepsspelers beheer je in de groep. Voeg hier gastspelers toe voor dit concert.",
  "Group players cannot be removed after concerts have been created, to preserve concert history.":
    "Groepsspelers kunnen niet worden verwijderd nadat concerten zijn aangemaakt, om de concertgeschiedenis te behouden.",
  Concerts: "Concerten",
  "Create your first concert for this group.": "Maak het eerste concert voor deze groep aan.",
  "Share group": "Groep delen",
  "← Back to group": "← Terug naar de groep",
  "Edit group name": "Groepsnaam wijzigen",
  "Edit group": "Groep bewerken",
  "Remove group shortcut": "Groepssnelkoppeling verwijderen",
  "Removes this shortcut from this browser, not the shared group or its concerts.":
    "Verwijdert alleen de snelkoppeling uit deze browser, niet de gedeelde groep of concerten.",
  "Group icon": "Groepsicoon",
  "Edit group icon": "Groepsicoon wijzigen",
  People: "Mensen",
  Drum: "Trommel",
  Triangle: "Triangel",
  Cymbal: "Bekken",
  Guitar: "Gitaar",
  Piano: "Piano",
  Keyboard: "Keyboard",
  Microphone: "Microfoon",
  Singing: "Zang",
  "Music note": "Muzieknoot",
  "Music note 2": "Muzieknoot 2",
  "Music notes": "Muzieknoten",
  "Music notes 2": "Muzieknoten 2",
  "Music list": "Muzieklijst",
  "Sound bars": "Geluidsbalken",
  "Sound wave": "Geluidsgolf",
  Headphones: "Koptelefoon",
  Speaker: "Luidspreker",
  Radio: "Radio",
  Boombox: "Boombox",
  Record: "Plaat",
  Cassette: "Cassette",
  "Loading your group…": "Je groep laden…",
  "This group link is invalid.": "Deze groepslink is ongeldig.",
  "Group not found or the sharing key is invalid.":
    "Groep niet gevonden of de deelsleutel is ongeldig.",
  "This group changed. Refresh and try your edit again.":
    "Deze groep is gewijzigd. Vernieuw en probeer je wijziging opnieuw.",
  "Group players must be managed in the group.": "Groepsspelers beheer je in de groep.",
  "Browser storage is unavailable. Keep a copy of the group link.":
    "Browseropslag is niet beschikbaar. Bewaar een kopie van de groepslink.",
  "Could not copy automatically. Your sharing link:":
    "Automatisch kopiëren is niet gelukt. Je deellink:",
  "Music link (optional)": "Muzieklink (optioneel)",
  "Music player": "Muziekspeler",
  "Open music link": "Muzieklink openen",
  "Open on YouTube": "Openen op YouTube",
  "Open on Spotify": "Openen op Spotify",
  "Play in app": "Afspelen in de app",
  "Close player": "Speler sluiten",
  "Floating player": "Zwevende speler",
  "Return player here": "Speler hier terugzetten",
  "This link opens externally. In-app players support YouTube and Spotify.":
    "Deze link opent extern. Afspelen in de app werkt met YouTube en Spotify.",
  "Playback availability is controlled by the provider.":
    "De aanbieder bepaalt wat je kunt afspelen.",
  "Spotify may play previews. Sign in to Spotify for full playback where available.":
    "Spotify speelt mogelijk alleen fragmenten af. Log in bij Spotify om waar mogelijk volledig te luisteren.",
  "Opening or returning the floating player may restart playback.":
    "Het openen of terugzetten van de zwevende speler kan het afspelen opnieuw starten.",
  "Picture-in-Picture is not supported in this browser.":
    "Picture-in-Picture wordt niet ondersteund door deze browser.",
  "Could not open Picture-in-Picture. Try the embedded player or open the link.":
    "Picture-in-Picture openen is niet gelukt. Gebruik de ingesloten speler of open de link.",
  "Pick a date": "Kies een datum",
  "Clear date": "Datum wissen",
  "Opening PodiumPanda…": "PodiumPanda openen…",
  "Make room for music": "Maak ruimte voor muziek",
  "App switcher": "Appkiezer",
  Apps: "Apps",
  "A little more music": "Nog meer muziek",
  "More music tools are on the way.": "Er komen meer muziekhulpmiddelen aan.",
  Metronome: "Metronoom",
  "Practice with a steady, adjustable click.": "Oefen met een regelmatige, instelbare tik.",
  Tempo: "Tempo",
  "Beats per bar": "Tellen per maat",
  "Decrease beats per bar": "Minder tellen per maat",
  "Increase beats per bar": "Meer tellen per maat",
  "Decrease beat unit": "Kleinere maatnoot",
  "Increase beat unit": "Grotere maatnoot",
  "Decrease subdivision": "Onderverdeling verlagen",
  "Increase subdivision": "Onderverdeling verhogen",
  "Subdivision count {count}": "Onderverdeling {count}",
  "Time signature": "Maatsoort",
  "Time signature value {beats} over {unit}": "Maatsoort {beats} over {unit}",
  Subdivision: "Onderverdeling",
  "Tap tempo": "Tik tempo",
  "Start metronome": "Metronoom starten",
  "Stop metronome": "Metronoom stoppen",
  "Decrease tempo": "Tempo verlagen",
  "Increase tempo": "Tempo verhogen",
  "Audio playback is not supported in this browser.":
    "Audio afspelen wordt niet ondersteund door deze browser.",
  "Could not start metronome audio.": "De metronoom kon niet worden gestart.",
  "Could not play metronome audio.": "De metronoom kon geen geluid afspelen.",
  "Switch to light mode": "Lichte modus inschakelen",
  "Switch to dark mode": "Donkere modus inschakelen",
  Language: "Taal",
  "A little harmony before the concert": "Een beetje harmonie vóór het concert",
  "Your concert.": "Jouw concert.",
  "Everyone in tune.": "Iedereen in harmonie.",
  "Build the setlist, find everyone’s part, and make room on stage. One shared link. No accounts needed.":
    "Maak de setlist, verdeel de partijen en richt het podium in. Eén gedeelde link. Geen accounts nodig.",
  Setlists: "Setlists",
  "Players & parts": "Spelers & partijen",
  Floorplans: "Podiumplannen",
  "PodiumPanda, a cheerful panda conductor waving a baton":
    "PodiumPanda, een vrolijke pandadirigent met een dirigeerstok",
  "Let’s prepare a concert": "Laten we een concert voorbereiden",
  "Concert name": "Concertnaam",
  "An evening of music": "Een avond vol muziek",
  "Date (optional)": "Datum (optioneel)",
  "Creating…": "Aanmaken…",
  "Create concert": "Concert aanmaken",
  "Everyone with the link can view and edit. Share it only with people you trust.":
    "Iedereen met de link kan alles bekijken en bewerken. Deel de link alleen met mensen die je vertrouwt.",
  "Your recent concerts": "Je recente concerten",
  "Your next concert starts here. Create one above, or open a link from your group.":
    "Je volgende concert begint hier. Maak er hierboven een aan of open een link van je groep.",
  "Open concert →": "Concert openen →",
  "Forget shortcut to {name}": "Snelkoppeling naar {name} vergeten",
  "Who’s playing?": "Wie spelen er mee?",
  "Names, not accounts. Anyone can help keep the roster up to date.":
    "Namen, geen accounts. Iedereen kan helpen de spelerslijst bij te houden.",
  "Player name": "Naam van de speler",
  "Instrument or role": "Instrument of rol",
  "Instrument / role (optional)": "Instrument / rol (optioneel)",
  "Add player": "Speler toevoegen",
  "Add your group to start gathering preferences.":
    "Voeg je groep toe om voorkeuren te verzamelen.",
  "Edit player name": "Naam van de speler bewerken",
  "Edit instrument": "Instrument bewerken",
  Save: "Opslaan",
  Cancel: "Annuleren",
  "No instrument specified": "Geen instrument opgegeven",
  "Edit {name}": "{name} bewerken",
  "Delete {name}": "{name} verwijderen",
  "Delete?": "Verwijderen?",
  "Cancel deletion": "Verwijderen annuleren",
  "The programme": "Het programma",
  "pieces ·": "stukken ·",
  parts: "partijen",
  "Piece title": "Titel van het stuk",
  "Add a piece to the setlist": "Voeg een stuk toe aan de setlist",
  "Add piece": "Stuk toevoegen",
  "Build your setlist, then add whichever parts each piece needs.":
    "Maak je setlist en voeg voor elk stuk de benodigde partijen toe.",
  "Move {name} up": "{name} omhoog verplaatsen",
  "Move {name} down": "{name} omlaag verplaatsen",
  Title: "Titel",
  "Duration (minutes)": "Duur (minuten)",
  Notes: "Notities",
  Floorplan: "Podiumplan",
  "Concert default": "Standaard voor dit concert",
  "Save piece": "Stuk opslaan",
  "New part for {name}": "Nieuwe partij voor {name}",
  "Part name, e.g. Violin 1": "Partijnaam, bijvoorbeeld Viool 1",
  Part: "Partij",
  "Part name": "Partijnaam",
  "Part notes": "Notities bij de partij",
  "Notes (optional)": "Notities (optioneel)",
  "Edit part {name}": "Partij {name} bewerken",
  "What would everyone like to play?": "Wat wil iedereen graag spelen?",
  "Give everyone their part": "Verdeel de partijen",
  "Preferences are suggestions, not final assignments.":
    "Voorkeuren zijn suggesties, geen definitieve toewijzingen.",
  "Assign several players to a part, and several parts to a player. Preferences don’t restrict your decisions.":
    "Wijs meerdere spelers aan een partij toe en meerdere partijen aan een speler. Voorkeuren beperken je keuzes niet.",
  "Only show me": "Alleen mij tonen",
  "No parts assigned to you yet.": "Er zijn nog geen partijen aan jou toegewezen.",
  "Turn off Only show me to assign more parts.":
    "Schakel Alleen mij tonen uit om meer partijen toe te wijzen.",
  "Editing preferences for": "Voorkeuren bewerken voor",
  "Choose a player": "Kies een speler",
  "Choose a player to edit their preferences.": "Kies een speler om diens voorkeuren te bewerken.",
  "Scroll sideways to see all players.": "Veeg zijwaarts om alle spelers te zien.",
  Favorite: "Favoriet",
  "Add players and setlist parts first.": "Voeg eerst spelers en partijen toe.",
  "Piece / part": "Stuk / partij",
  " (you)": " (jij)",
  "Assign {player} to {part} in {entry}": "{player} toewijzen aan {part} in {entry}",
  Assigned: "Toegewezen",
  "Not assigned": "Niet toegewezen",
  "No preference": "Geen voorkeur",
  "Keen to play": "Speel ik graag",
  "Happy to play": "Speel ik prima",
  "Prefer not to": "Liever niet",
  Unavailable: "Niet beschikbaar",
  "{player} preference for {part}": "Voorkeur van {player} voor {part}",
  "{player} preference for {part} in {entry}": "Voorkeur van {player} voor {part} in {entry}",
  "Preference note for {name}": "Voorkeurnotitie voor {name}",
  "Preference note for {player}, {part} in {entry}":
    "Voorkeurnotitie van {player} voor {part} in {entry}",
  "Save note": "Notitie opslaan",
  "+ Add note": "+ Notitie toevoegen",
  "Concert details": "Concertgegevens",
  Name: "Naam",
  Date: "Datum",
  "Default floorplan": "Standaard podiumplan",
  None: "Geen",
  "Changes arrived while this form was open. Reopen this tab to load the latest details before saving.":
    "Er zijn wijzigingen binnengekomen terwijl dit formulier openstond. Open dit tabblad opnieuw om de laatste gegevens te laden voordat je opslaat.",
  "Save details": "Gegevens opslaan",
  "No floorplans yet": "Nog geen podiumplannen",
  "New floorplan name": "Naam van het nieuwe podiumplan",
  "Another stage setup": "Een andere podiumopstelling",
  "Rename floorplan": "Podiumplan hernoemen",
  Rename: "Hernoemen",
  "Create a floorplan to begin": "Maak eerst een podiumplan",
  Chair: "Stoel",
  Stand: "Lessenaar",
  Square: "Vierkant",
  Rectangle: "Rechthoek",
  "Melodic instrument": "Melodisch instrument",
  Player: "Speler",
  Piece: "Stuk",
  Object: "Object",
  Preference: "Voorkeur",
  Assignment: "Toewijzing",
  Label: "Label",
  "Stage label": "Podiumlabel",
  "Main stage": "Hoofdpodium",
  Audience: "Publiek",
  "Show gridlines": "Rasterlijnen tonen",
  "Audience at the bottom. Drag objects to move them; select one to resize or rotate it using the handles.":
    "Het publiek zit onderaan. Sleep objecten om ze te verplaatsen; selecteer een object om het met de handvatten te vergroten, verkleinen of draaien.",
  "Select an object on stage or from the list below.":
    "Selecteer een object op het podium of in de lijst hieronder.",
  "Audience at the bottom. Drag objects to position them; select one to edit its details. Different pieces can use different floorplans.":
    "Het publiek zit onderaan. Sleep objecten naar hun plek en selecteer ze om details te bewerken. Verschillende stukken kunnen verschillende podiumplannen gebruiken.",
  "Object details": "Objectgegevens",
  "Select an object on stage or from the list below. Player placements don’t change musical assignments.":
    "Selecteer een object op het podium of in de lijst hieronder. Spelers verplaatsen verandert de partijverdeling niet.",
  "stage objects": "podiumobjecten",
  "Player (optional)": "Speler (optioneel)",
  "No player": "Geen speler",
  "Part (optional)": "Partij (optioneel)",
  "No part": "Geen partij",
  Width: "Breedte",
  Height: "Hoogte",
  Rotation: "Rotatie",
  "Save object": "Object opslaan",
  "Shared changes arrived. Your draft is preserved; reload before saving.":
    "Er zijn gedeelde wijzigingen binnengekomen. Je concept is bewaard; laad het object opnieuw voordat je opslaat.",
  "Reload object": "Object opnieuw laden",
  "Loading floorplan editor…": "Podiumeditor laden…",
  "This concert link is invalid.": "Deze concertlink is ongeldig.",
  "Open with the full sharing link": "Open de volledige gedeelde link",
  "This address is missing its sharing key. Ask your group for the full link, including the portion after #.":
    "De toegangssleutel ontbreekt in dit adres. Vraag je groep om de volledige link, inclusief het gedeelte na #.",
  "Sharing key": "Toegangssleutel",
  "Paste sharing key": "Plak de toegangssleutel",
  Open: "Openen",
  "Could not open concert": "Concert openen is niet gelukt",
  "Try again": "Opnieuw proberen",
  "Loading your concert…": "Je concert laden…",
  "Concert workspace": "Concertwerkruimte",
  "Date to be decided": "Datum nog te bepalen",
  players: "spelers",
  "Everyone can edit": "Iedereen kan bewerken",
  "I’m playing as": "Ik speel als",
  "Choose your name": "Kies je naam",
  Copied: "Gekopieerd",
  "Share concert": "Concert delen",
  "Saving…": "Opslaan…",
  "Updates disconnected. Your view may be out of date.":
    "Verbinding voor updates verbroken. Je overzicht is mogelijk verouderd.",
  "Saved · Checking for changes every 2 seconds · Revision {revision}":
    "Opgeslagen · Elke 2 seconden controleren op wijzigingen · Versie {revision}",
  Refresh: "Vernieuwen",
  Dismiss: "Sluiten",
  Setlist: "Setlist",
  Players: "Spelers",
  Preferences: "Voorkeuren",
  Assignments: "Partijverdeling",
  Details: "Gegevens",
  History: "Geschiedenis",
  "Recent changes": "Recente wijzigingen",
  "Undo last edit": "Laatste wijziging ongedaan maken",
  "Undo restores the most recent shared edit, including deleted items. Names aren’t verified, so edits aren’t attributed to people.":
    "Ongedaan maken herstelt de laatste gedeelde wijziging, inclusief verwijderde items. Namen zijn niet geverifieerd, dus wijzigingen worden niet aan personen gekoppeld.",
  "Loading history…": "Geschiedenis laden…",
  "Page not found": "Pagina niet gevonden",
  "Go home": "Naar de startpagina",
  "Something went wrong": "Er ging iets mis",
  "An unexpected error occurred.": "Er is een onverwachte fout opgetreden.",
  "Browser storage is unavailable.": "Browseropslag is niet beschikbaar.",
  "Browser storage is unavailable. Keep a copy of the concert link.":
    "Browseropslag is niet beschikbaar. Bewaar een kopie van de concertlink.",
  "Could not remove the shortcut from browser storage.":
    "De snelkoppeling kon niet uit de browseropslag worden verwijderd.",
  "Browser storage is unavailable. Keep the full sharing link to reopen this concert.":
    "Browseropslag is niet beschikbaar. Bewaar de volledige gedeelde link om dit concert opnieuw te openen.",
  "Could not save your shortcut in this browser. Keep a copy of the sharing link.":
    "De snelkoppeling kon niet in deze browser worden opgeslagen. Bewaar een kopie van de gedeelde link.",
  "Your player selection could not be remembered on this device.":
    "Je spelerskeuze kon niet op dit apparaat worden onthouden.",
  "Could not copy automatically. Your sharing link: {link}":
    "Automatisch kopiëren is niet gelukt. Je gedeelde link: {link}",
  "Saved concert shortcuts are unreadable. Browser storage can be cleared to reset them.":
    "De opgeslagen concertsnelkoppelingen zijn onleesbaar. Wis de browseropslag om ze opnieuw in te stellen.",
  "The concert has not loaded yet.": "Het concert is nog niet geladen.",
  "The request failed.": "Het verzoek is mislukt.",
  "Invalid input.": "Ongeldige invoer.",
  "A sharing key is required.": "Een toegangssleutel is vereist.",
  "The sharing key is malformed.": "De toegangssleutel heeft een ongeldig formaat.",
  "Concert not found or the sharing key is invalid.":
    "Het concert is niet gevonden of de toegangssleutel is ongeldig.",
  "Someone else saved an edit first. Refresh and try again.":
    "Iemand anders heeft eerst een wijziging opgeslagen. Vernieuw en probeer opnieuw.",
  "This concert changed. Refresh and try your edit again.":
    "Dit concert is gewijzigd. Vernieuw en probeer je wijziging opnieuw.",
  "The concert changed. Refresh before undoing.":
    "Het concert is gewijzigd. Vernieuw voordat je een wijziging ongedaan maakt.",
  "The concert is being edited. Please try again.":
    "Het concert wordt momenteel bewerkt. Probeer opnieuw.",
  "The concert could not be saved or loaded. Please try again.":
    "Het concert kon niet worden opgeslagen of geladen. Probeer opnieuw.",
  "There is no edit to undo.": "Er is geen wijziging om ongedaan te maken.",
  "This edit affects too many items. Delete smaller groups first.":
    "Deze wijziging raakt te veel items. Verwijder eerst kleinere groepen.",
  "This edit is too large to save safely. Edit fewer items at once.":
    "Deze wijziging is te groot om veilig op te slaan. Bewerk minder items tegelijk.",
  "An existing item cannot change its type.":
    "Het type van een bestaand item kan niet worden gewijzigd.",
  "That item no longer exists.": "Dat item bestaat niet meer.",
  "Reordering must include every setlist entry exactly once.":
    "Bij het herschikken moet elk setlistitem precies één keer voorkomen.",
  "This player already has an item for that part.":
    "Deze speler heeft al een item voor die partij.",
  "The referenced {kind} does not exist.": "De gekoppelde {kind} bestaat niet.",
  "Saved {kind}": "{kind} opgeslagen",
  "Deleted item and dependent references": "Item en afhankelijke verwijzingen verwijderd",
  "Reordered setlist": "Setlist opnieuw geordend",
  "Updated concert details": "Concertgegevens bijgewerkt",
  "Undid revision {revision}": "Versie {revision} ongedaan gemaakt",
} satisfies Record<string, string>;

const translations = new Map<string, string>(Object.entries(dutch));
export function translate(
  locale: Locale,
  key: string,
  values: Record<string, string | number> = {},
) {
  const message = locale === "nl" ? (translations.get(key) ?? key) : key;
  return message.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}

export function translateDynamic(locale: Locale, message: string) {
  const references = /^The referenced (player|entry|part|floorplan) does not exist\.$/.exec(
    message,
  );
  const kinds: Record<string, string> = {
    player: "Player",
    entry: "Piece",
    part: "Part",
    floorplan: "Floorplan",
    object: "Object",
    preference: "Preference",
    assignment: "Assignment",
  };
  if (references)
    return translate(locale, "The referenced {kind} does not exist.", {
      kind: translate(locale, kinds[references[1]]),
    });
  const saved = /^Saved (\w+)$/.exec(message);
  if (saved)
    return translate(locale, "Saved {kind}", {
      kind: translate(locale, kinds[saved[1]] ?? saved[1]),
    });
  const undone = /^Undid revision (\d+)$/.exec(message);
  if (undone) return translate(locale, "Undid revision {revision}", { revision: undone[1] });
  const copied = /^Could not copy automatically\. Your sharing link: (.+)$/.exec(message);
  if (copied)
    return translate(locale, "Could not copy automatically. Your sharing link: {link}", {
      link: copied[1],
    });
  return translate(locale, message);
}
