(() => {
  const STORAGE_KEY = 'epd-heft-epd14-v1';
  const SEED_VERSION = 'wortschatz-2026-09-17-v2';

  const now = Date.now();
  const card = (de, ru, index) => ({
    id: `seed-${index}`,
    de,
    ru,
    createdAt: now,
    updatedAt: now,
  });

  const rawDecks = [
    {
      title: 'Gruppenarbeit — Verben',
      cards: [
        ['zusammenarbeiten', 'сотрудничать'],
        ['Aufgaben verteilen', 'распределять задачи'],
        ['sich einigen auf + Akk.', 'договариваться о чём-либо'],
        ['Vorschläge einbringen', 'вносить предложения'],
        ['Meinungen austauschen', 'обмениваться мнениями'],
        ['Verantwortung übernehmen', 'брать на себя ответственность'],
        ['Konflikte lösen', 'разрешать конфликты'],
        ['Ergebnisse erzielen', 'достигать результатов'],
        ['von jemandem profitieren', 'получать пользу от кого-либо'],
        ['etwas berücksichtigen', 'учитывать что-либо'],
      ],
    },
    {
      title: 'Gruppenarbeit — Substantive',
      cards: [
        ['die Zusammenarbeit', 'сотрудничество'],
        ['die Aufgabenverteilung', 'распределение задач'],
        ['der Meinungsaustausch', 'обмен мнениями'],
        ['die Verantwortung', 'ответственность'],
        ['die Absprache', 'договорённость / согласование'],
        ['der Zeitaufwand', 'затраты времени'],
        ['die Abhängigkeit', 'зависимость'],
        ['die Meinungsverschiedenheit', 'разногласие'],
        ['die Arbeitsteilung', 'разделение труда'],
        ['die Leistungsfähigkeit', 'работоспособность / эффективность'],
      ],
    },
    {
      title: 'Einleitung',
      cards: [
        ['Heutzutage wird häufig darüber diskutiert, ob ...', 'В настоящее время часто обсуждается вопрос о том, ...'],
        ['Das Thema ... spielt heutzutage eine immer wichtigere Rolle.', 'Тема ... играет в настоящее время всё более важную роль.'],
        ['In den letzten Jahren hat die Bedeutung von ... deutlich zugenommen.', 'В последние годы значение ... заметно возросло.'],
        ['Die Frage, ob ..., wird zunehmend kontrovers diskutiert.', 'Вопрос о том, ..., всё чаще вызывает споры.'],
        ['Im folgenden Text möchte ich verschiedene Aspekte dieses Themas beleuchten.', 'В следующем тексте я хотел(а) бы рассмотреть различные аспекты этой темы.'],
        ['Nachfolgend sollen Argumente für und gegen dieses Thema angeführt und gegeneinander abgewogen werden.', 'Далее будут приведены аргументы за и против этой темы и сопоставлены друг с другом.'],
        ['In einem ersten Schritt möchte ich die Nachteile, in einem zweiten Schritt die Vorteile darstellen.', 'Сначала я хотел(а) бы представить недостатки, а затем преимущества.'],
      ],
    },
    {
      title: 'Hauptteil',
      cards: [
        ['Als erstes Argument lässt sich anführen, dass ...', 'В качестве первого аргумента можно привести то, что ...'],
        ['Ein wichtiger Vorteil/Nachteil besteht darin, dass ...', 'Важное преимущество/недостаток заключается в том, что ...'],
        ['Zu Beginn ist darauf hinzuweisen, dass ...', 'Вначале следует отметить, что ...'],
        ['Zunächst sollte berücksichtigt werden, dass ...', 'Прежде всего следует учитывать, что ...'],
        ['Darüber hinaus ...', 'Кроме того, ...'],
        ['Des Weiteren ...', 'Кроме того / далее, ...'],
        ['Ferner ...', 'Кроме того, ...'],
        ['Außerdem ...', 'Кроме того, ...'],
        ['Ein weiterer wichtiger Aspekt ist, dass ...', 'Ещё один важный аспект заключается в том, что ...'],
        ['Nicht zuletzt ...', 'Не в последнюю очередь, ...'],
      ],
    },
    {
      title: 'Zwei Seiten vergleichen',
      cards: [
        ['Einerseits ..., andererseits ...', 'С одной стороны ..., с другой стороны ...'],
        ['Auf der einen Seite ..., auf der anderen Seite ...', 'С одной стороны ..., с другой стороны ...'],
        ['Zum einen ..., zum anderen ...', 'С одной стороны ..., с другой стороны ...'],
        ['Zwar ..., aber ...', 'Хотя ..., но ...'],
        ['Obwohl ..., darf nicht außer Acht gelassen werden, dass ...', 'Хотя ..., нельзя упускать из виду, что ...'],
      ],
    },
    {
      title: 'Argumente einführen',
      cards: [
        ['Für diese Ansicht spricht, dass ...', 'В пользу этой точки зрения говорит то, что ...'],
        ['Dagegen spricht, dass ...', 'Против этого говорит то, что ...'],
        ['Als Argument dafür kann man anführen, dass ...', 'В качестве аргумента в пользу этого можно привести то, что ...'],
        ['Ein weiterer positiver Aspekt ist ...', 'Ещё один положительный аспект — ...'],
        ['Ein wesentlicher Nachteil besteht darin, dass ...', 'Существенный недостаток заключается в том, что ...'],
        ['Als problematisch kann man betrachten, dass ...', 'Проблемой можно считать то, что ...'],
        ['Von Vorteil ist außerdem, dass ...', 'Кроме того, преимуществом является то, что ...'],
      ],
    },
    {
      title: 'Gründe erklären',
      cards: [
        ['Dies liegt vor allem daran, dass ...', 'Это связано прежде всего с тем, что ...'],
        ['Der Grund dafür ist, dass ...', 'Причина заключается в том, что ...'],
        ['Dies lässt sich dadurch erklären, dass ...', 'Это можно объяснить тем, что ...'],
        ['Dies ist darauf zurückzuführen, dass ...', 'Это обусловлено тем, что ...'],
        ['Aufgrund dessen ...', 'Вследствие этого / на основании этого ...'],
        ['Aus diesem Grund ...', 'По этой причине ...'],
      ],
    },
    {
      title: 'Beispiele',
      cards: [
        ['Ein gutes Beispiel dafür ist ...', 'Хорошим примером этого является ...'],
        ['Dies lässt sich an folgendem Beispiel verdeutlichen: ...', 'Это можно наглядно показать на следующем примере: ...'],
        ['Als Beispiel kann hier ... dienen.', 'В качестве примера здесь может служить ...'],
        ['Folgendes Beispiel zeigt, dass ...', 'Следующий пример показывает, что ...'],
        ['Aus eigener Erfahrung kann ich sagen, dass ...', 'Из собственного опыта я могу сказать, что ...'],
      ],
    },
    {
      title: 'Folgen ausdrücken',
      cards: [
        ['Dies führt dazu, dass ...', 'Это приводит к тому, что ...'],
        ['Dadurch kann ...', 'Благодаря этому / в результате этого может ...'],
        ['Infolgedessen ...', 'Вследствие этого ...'],
        ['Folglich ...', 'Следовательно, ...'],
        ['Somit ...', 'Таким образом, ...'],
        ['Aus diesem Grund ...', 'По этой причине ...'],
      ],
    },
    {
      title: 'Eigene Meinung',
      cards: [
        ['Meiner Meinung nach ...', 'По моему мнению, ...'],
        ['Meiner Auffassung nach ...', 'По моему мнению / на мой взгляд, ...'],
        ['Ich bin der Ansicht, dass ...', 'Я придерживаюсь мнения, что ...'],
        ['Ich vertrete die Auffassung, dass ...', 'Я придерживаюсь точки зрения, что ...'],
        ['Aus meiner Sicht ...', 'С моей точки зрения, ...'],
        ['Meines Erachtens ...', 'По моему мнению / на мой взгляд, ...'],
      ],
    },
    {
      title: 'Gegenposition',
      cards: [
        ['Allerdings darf man nicht außer Acht lassen, dass ...', 'Однако нельзя упускать из виду, что ...'],
        ['Demgegenüber steht jedoch ...', 'Однако этому противопоставляется ...'],
        ['Andererseits muss berücksichtigt werden, dass ...', 'С другой стороны, необходимо учитывать, что ...'],
        ['Dennoch ist zu beachten, dass ...', 'Тем не менее следует учитывать, что ...'],
        ['Trotz dieser Vorteile gibt es auch einige Nachteile.', 'Несмотря на эти преимущества, существуют и некоторые недостатки.'],
        ['Auf der anderen Seite lassen sich auch kritische Aspekte nennen.', 'С другой стороны, можно назвать и критические аспекты.'],
      ],
    },
    {
      title: 'Schluss / Fazit',
      cards: [
        ['Zusammenfassend lässt sich sagen, dass ...', 'Подводя итог, можно сказать, что ...'],
        ['Zusammenfassend lässt sich feststellen, dass ...', 'Подводя итог, можно констатировать, что ...'],
        ['Abschließend kann festgehalten werden, dass ...', 'В заключение можно отметить, что ...'],
        ['Aus den genannten Argumenten lässt sich schließen, dass ...', 'Из приведённых аргументов можно сделать вывод, что ...'],
        ['Unter Berücksichtigung der genannten Aspekte bin ich der Meinung, dass ...', 'Учитывая приведённые аспекты, я считаю, что ...'],
        ['Letztlich hängt es davon ab, ob ...', 'В конечном счёте это зависит от того, ...'],
        ['Meiner Auffassung nach überwiegen die Vorteile/Nachteile.', 'По моему мнению, преимущества/недостатки перевешивают.'],
      ],
    },
  ];

  const decks = rawDecks.map((deck, deckIndex) => ({
    id: `seed-deck-${deckIndex + 1}`,
    title: deck.title,
    description: '',
    cards: deck.cards.map(([de, ru], cardIndex) => card(de, ru, `${deckIndex + 1}-${cardIndex + 1}`)),
    createdAt: now,
    updatedAt: now,
  }));

  let data = {};
  try {
    data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    data = {};
  }

  if (data.wortschatzSeedVersion === SEED_VERSION) return;

  data.words = [];
  data.decks = decks;
  data.migratedWordsAt = now;
  data.wortschatzSeedVersion = SEED_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
})();
