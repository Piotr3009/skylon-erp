# 🧪 PLAN TESTÓW - NAPRAWA BUGÓW FAZ PROJEKTOWYCH

**Data:** 2025-10-22
**Branch:** `claude/analyze-production-code-011CUNfndZPgcSZzP5GXTStp`
**Naprawione bugi:** 3 krytyczne

---

## 📋 PRZYGOTOWANIE DO TESTÓW

### 1. Pobierz zmiany z brancha
```bash
cd /home/user/skylon-erp
git fetch origin
git checkout claude/analyze-production-code-011CUNfndZPgcSZzP5GXTStp
git pull origin claude/analyze-production-code-011CUNfndZPgcSZzP5GXTStp
```

### 2. Zrób backup bazy danych (WAŻNE!)
```bash
# Jeśli używasz PostgreSQL:
pg_dump -h localhost -U your_user -d skylon_erp > backup_before_tests_$(date +%Y%m%d_%H%M%S).sql

# Jeśli używasz Supabase - zrób backup przez dashboard
```

### 3. Uruchom aplikację lokalnie
```bash
# Otwórz index.html w przeglądarce
# LUB użyj lokalnego serwera (jeśli masz):
python3 -m http.server 8000
# Potem otwórz: http://localhost:8000
```

### 4. Otwórz DevTools (F12)
- Przejdź do zakładki **Console**
- Wyczyść konsole (ikona śmietnika)
- Zostaw otwarte podczas testów

---

## 🧪 SCENARIUSZE TESTOWE

### TEST 1: Dodawanie nowych faz do istniejącego projektu ✅ BUG #1

**Cel:** Sprawdzić czy nowe fazy układają się sekwencyjnie z 1 dniem odstępu

**Kroki:**
1. [ ] Znajdź projekt który ma już kilka faz (np. 025/2025 lub inny)
2. [ ] Kliknij "Edit" na projekcie
3. [ ] Zaznacz 2-3 **nowe** fazy (które projekt jeszcze nie ma)
4. [ ] Kliknij "Save"
5. [ ] Obserwuj daty w Gantt chart

**Oczekiwany rezultat:**
- [ ] Każda nowa faza ma **różną** datę rozpoczęcia
- [ ] Odstęp między fazami: **1 dzień roboczy** (pomijając weekendy)
- [ ] W konsoli: `💾 Saving X phases for project ...`
- [ ] W konsoli: `✅ Successfully saved X phases`

**Jeśli FAIL:**
- [ ] Zapisz screenshot Gantt chart
- [ ] Skopiuj błędy z konsoli
- [ ] Sprawdź w bazie danych daty faz

---

### TEST 2: Usuwanie fazy z projektu ✅ BUG #3

**Cel:** Sprawdzić czy usunięta faza znika również z bazy danych

**Kroki:**
1. [ ] Wybierz projekt z kilkoma fazami
2. [ ] Kliknij dwukrotnie na jedną z faz (otwiera modal edycji)
3. [ ] Kliknij "Delete Phase"
4. [ ] Potwierdź usunięcie
5. [ ] Obserwuj konsole

**Oczekiwany rezultat:**
- [ ] Faza znika z Gantt chart natychmiast
- [ ] W konsoli: `✅ Phase deleted and database updated`
- [ ] **KRYTYCZNE:** Odśwież stronę (F5) - faza **NIE powinna wrócić**

**Test w bazie danych:**
```sql
-- Sprawdź czy faza zniknęła z bazy:
SELECT pp.*, ph.name
FROM project_phases pp
LEFT JOIN ... -- uzupełnij nazwy faz
WHERE pp.project_id = 'ID_PROJEKTU';
```

**Jeśli FAIL:**
- [ ] Faza wraca po odświeżeniu → BUG NIE NAPRAWIONY
- [ ] Skopiuj wszystkie błędy z konsoli

---

### TEST 3: Usuwanie specjalnych faz (Order Materials, Order Glazing, Order Spray)

**Cel:** Sprawdzić czy wszystkie 4 funkcje usuwania działają

**Kroki:**
1. [ ] Projekt z fazą "Order Materials"
   - [ ] Kliknij dwukrotnie na "Order Materials"
   - [ ] Kliknij "Delete Order Materials Phase"
   - [ ] Sprawdź konsole: `✅ Phase deleted and database updated`

2. [ ] Projekt z fazą "Order Glazing"
   - [ ] Kliknij dwukrotnie na "Order Glazing"
   - [ ] Kliknij "Delete Order Glazing Phase"
   - [ ] Sprawdź konsole

3. [ ] Projekt z fazą "Order Spray Materials"
   - [ ] Kliknij dwukrotnie na "Order Spray"
   - [ ] Kliknij "Delete Order Spray Phase"
   - [ ] Sprawdź konsole

**Dla każdej:**
- [ ] Odśwież (F5) - faza NIE wraca
- [ ] Sprawdź w bazie danych

---

### TEST 4: Edycja projektu BEZ zmiany faz ✅ BUG #2

**Cel:** Sprawdzić czy walidacja nie blokuje normalnych operacji

**Kroki:**
1. [ ] Wybierz dowolny projekt
2. [ ] Kliknij "Edit"
3. [ ] Zmień tylko nazwę projektu lub deadline
4. [ ] **NIE zmieniaj** faz (nie zaznaczaj/odznaczaj checkboxów)
5. [ ] Kliknij "Save"

**Oczekiwany rezultat:**
- [ ] Projekt zapisany bez błędów
- [ ] W konsoli: `💾 Saving X phases...`
- [ ] W konsoli: `✅ Successfully saved X phases`
- [ ] **BRAK** błędów typu `❌ CRITICAL: phases is not an array!`
- [ ] Fazy pozostają niezmienione

---

### TEST 5: Drag & Drop fazy

**Cel:** Sprawdzić czy przesuwanie faz synchronizuje się z bazą

**Kroki:**
1. [ ] Wybierz projekt z kilkoma fazami
2. [ ] Przeciągnij jedną fazę na inną datę (drag & drop)
3. [ ] Zwolnij myszką
4. [ ] Obserwuj konsole

**Oczekiwany rezultat:**
- [ ] W konsoli: `💾 Saving X phases for project ...`
- [ ] W konsoli: `✅ Successfully saved X phases`
- [ ] Odśwież (F5) - nowa pozycja fazy zachowana

---

### TEST 6: Projekt bez faz ✅ BUG #2

**Cel:** Sprawdzić czy walidacja chroni przed utratą danych

**Kroki:**
1. [ ] Znajdź projekt który **nie ma** żadnych faz (lub usuń wszystkie)
2. [ ] Dodaj pierwszą fazę do tego projektu
3. [ ] Obserwuj konsole

**Oczekiwany rezultat:**
- [ ] Faza dodana pomyślnie
- [ ] W konsoli: `💾 Saving 1 phases for project ...`
- [ ] W konsoli: `✅ Successfully saved 1 phases`
- [ ] **BRAK** ostrzeżeń `⚠️ No phases to save`

---

### TEST 7: Projekt 025/2025 (Twój zgłoszony przypadek)

**Cel:** Sprawdzić czy problem z tym projektem jest rozwiązany

**Kroki:**
1. [ ] Otwórz projekt 025/2025
2. [ ] Sprawdź czy ma fazy w UI
3. [ ] Jeśli NIE ma faz:
   - [ ] Dodaj kilka faz
   - [ ] Zapisz
   - [ ] Sprawdź konsole
4. [ ] Odśwież stronę (F5)
5. [ ] Sprawdź czy fazy zostały

**Oczekiwany rezultat:**
- [ ] Fazy są widoczne
- [ ] Po odświeżeniu fazy NIE znikają
- [ ] W konsoli brak błędów

**Sprawdź w bazie:**
```sql
SELECT * FROM projects WHERE project_number = '025/2025';
SELECT * FROM project_phases WHERE project_id = (
    SELECT id FROM projects WHERE project_number = '025/2025'
);
```

---

### TEST 8: Resize fazy (zmiana długości)

**Cel:** Sprawdzić czy zmiana długości fazy zapisuje się

**Kroki:**
1. [ ] Wybierz fazę
2. [ ] Uchwyć prawy brzeg fazy
3. [ ] Rozciągnij lub zmniejsz fazę
4. [ ] Zwolnij myszką
5. [ ] Obserwuj konsole

**Oczekiwany rezultat:**
- [ ] Nowa długość fazy zachowana
- [ ] W konsoli: `✅ Successfully saved X phases`
- [ ] Odśwież (F5) - długość zachowana

---

## 📊 MONITORING KONSOLI

### ✅ **Prawidłowe logi (DOBRE):**
```
💾 Saving 5 phases for project abc123-def-456
✅ Successfully saved 5 phases
✅ Phase deleted and database updated
✅ All phases saved successfully
```

### ⚠️ **Ostrzeżenia (NORMALNE dla niektórych przypadków):**
```
⚠️ No phases to save - skipping database update to preserve existing phases
⚠️ Could not find project in database: XXX
```

### ❌ **Błędy (ZŁE - zgłoś je!):**
```
❌ CRITICAL: phases is not an array!
❌ Aborting save to prevent data loss
❌ Failed to save phases
Error deleting old phases: ...
Error saving phases: ...
```

---

## 📝 RAPORT Z TESTÓW

### Podsumowanie wyników:

| Test | Status | Notatki |
|------|--------|---------|
| TEST 1: Dodawanie faz | ⬜ PASS / ⬜ FAIL | |
| TEST 2: Usuwanie fazy | ⬜ PASS / ⬜ FAIL | |
| TEST 3: Usuwanie specjalnych faz | ⬜ PASS / ⬜ FAIL | |
| TEST 4: Edycja bez zmiany faz | ⬜ PASS / ⬜ FAIL | |
| TEST 5: Drag & Drop | ⬜ PASS / ⬜ FAIL | |
| TEST 6: Projekt bez faz | ⬜ PASS / ⬜ FAIL | |
| TEST 7: Projekt 025/2025 | ⬜ PASS / ⬜ FAIL | |
| TEST 8: Resize fazy | ⬜ PASS / ⬜ FAIL | |

### Znalezione problemy:

1. **Problem 1:**
   - Opis:
   - Kroki do reprodukcji:
   - Logi z konsoli:

2. **Problem 2:**
   - Opis:
   - Kroki do reprodukcji:
   - Logi z konsoli:

---

## ✅ JEŚLI WSZYSTKO DZIAŁA

**Gotowe do wdrożenia na produkcję:**

1. Merge brancha do main:
   ```bash
   git checkout main
   git merge claude/analyze-production-code-011CUNfndZPgcSZzP5GXTStp
   git push origin main
   ```

2. Wdróż na produkcję

3. Monitoruj pierwsze 30 minut po wdrożeniu

---

## ❌ JEŚLI COŚ NIE DZIAŁA

**Skontaktuj się z Claude i przekaż:**
1. Numer testu który failuje
2. Screenshot Gantt chart
3. Wszystkie błędy z konsoli
4. Screenshot bazy danych (jeśli dotyczy)

**Nie wdrażaj na produkcję** dopóki wszystkie testy nie przejdą!

---

## 🔄 ROLLBACK (jeśli potrzebny)

```bash
# Przywróć poprzednią wersję kodu
git checkout main

# Przywróć backup bazy
psql -h localhost -U your_user -d skylon_erp < backup_before_tests_*.sql
```

---

**Powodzenia w testach! 🚀**
