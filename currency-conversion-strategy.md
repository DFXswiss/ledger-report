# Strategie zur Implementierung der Währungsumrechnung (CHF, USD, EUR)

## Aktueller Stand
Das Tool zeigt aktuell nur die **Anzahl der Token** an (z.B. "Balance: 1234.567890 USDT"). Es gibt keine Umrechnung in Fiat-Währungen.

## Ziel
Zusätzlich zur Token-Anzahl soll der **Wert in CHF, USD und EUR** angezeigt werden, basierend auf dem historischen Kurs zum gewählten Datum.

## Empfohlene Implementierungsstrategie

### 1. API-Integration für Preisdaten

#### Option A: **CoinGecko API** (Empfohlen)
- **Vorteile:**
  - Kostenloser Tier mit 10.000 Anfragen/Monat
  - Historische Preisdaten verfügbar
  - Unterstützt mehrere Währungen (CHF, USD, EUR)
  - Einfache REST API
- **Endpoint:** `/coins/{id}/history` für historische Daten
- **Implementation:**
  ```typescript
  // Beispiel-URL für USDT am 15.01.2024
  https://api.coingecko.com/api/v3/coins/tether/history?date=15-01-2024
  ```

#### Option B: **DFX.swiss API** (Falls verfügbar)
- **Vorteile:**
  - Bereits im Projekt verwendet für Asset-Daten
  - Möglicherweise genauere CHF-Kurse
  - Einheitliche Datenquelle
- **Zu prüfen:** Ob historische Preisdaten verfügbar sind

#### Option C: **CoinMarketCap API**
- **Nachteile:** Kostenpflichtig für historische Daten
- Nur als Fallback empfohlen

### 2. Architektur-Änderungen

#### 2.1 Neuer Custom Hook: `usePriceConversion`
```typescript
interface PriceData {
  usd: number;
  eur: number;
  chf: number;
}

const usePriceConversion = (
  tokenSymbol: string,
  amount: string,
  date: string
) => {
  // Fetch historical price
  // Calculate values in different currencies
  // Return converted amounts
}
```

#### 2.2 Token-Mapping erweitern
- Asset-Map um CoinGecko-IDs ergänzen
- Mapping zwischen DFX-Token-Namen und CoinGecko-IDs erstellen
- Beispiel:
  ```typescript
  const TOKEN_PRICE_MAP = {
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'ETH': 'ethereum',
    // ...
  }
  ```

#### 2.3 UI-Komponenten erweitern
- Neue Komponente `BalanceDisplay` für formatierte Anzeige
- Anzeige in mehreren Währungen:
  ```
  Balance: 1,234.57 USDT
  ≈ $1,234.57 USD
  ≈ €1,150.25 EUR
  ≈ CHF 1,075.50
  ```

### 3. Implementierungsschritte

1. **Environment Variable hinzufügen**
   - `VITE_COINGECKO_API_KEY` (falls Premium)
   - Oder Rate-Limiting für Free Tier implementieren

2. **Price Service erstellen**
   ```typescript
   // src/services/priceService.ts
   - fetchHistoricalPrice(tokenId, date)
   - convertToFiatCurrencies(amount, priceData)
   - formatCurrencyDisplay(value, currency)
   ```

3. **Caching-Strategie**
   - LocalStorage für bereits abgefragte Preise
   - Cache-Key: `price-${tokenId}-${date}`
   - Ablaufzeit: unbegrenzt (historische Daten ändern sich nicht)

4. **Error Handling**
   - Fallback auf aktuelle Preise wenn historische nicht verfügbar
   - Warnung anzeigen: "Using current prices (historical data unavailable)"
   - Graceful degradation: Nur Token-Balance anzeigen bei API-Fehler

5. **PDF-Export erweitern**
   - Währungswerte in PDF aufnehmen
   - Disclaimer: "Prices as of [date]"
   - Quelle angeben: "Price data from CoinGecko"

### 4. Performance-Optimierungen

- **Batch-Requests:** Mehrere Token-Preise in einer Anfrage
- **Lazy Loading:** Preise erst bei Balance-Abfrage laden
- **Debouncing:** Bei Datum-Änderung verzögert abfragen
- **Progressive Enhancement:** Erst Balance, dann Preise anzeigen

### 5. Besondere Überlegungen

#### Stablecoins
- USDT, USDC: Können mit 1:1 USD-Kurs angenommen werden
- Trotzdem historische Daten prüfen (De-pegging Events)

#### Non-USD Token
- Für Token wie ETH, BTC echte historische Kurse verwenden
- Volatilität berücksichtigen

#### Datum-Handling
- Zeitzone beachten (UTC vs. lokale Zeit)
- Wochenenden/Feiertage: Letzten verfügbaren Kurs verwenden

### 6. Testing-Strategie

- Mock-Daten für Entwicklung erstellen
- Edge Cases:
  - Token ohne Preisdaten
  - API-Ausfall
  - Sehr alte Daten (vor Token-Existenz)
  - Neue Token (noch keine Historie)

### 7. Nächste Schritte

1. **Proof of Concept** mit CoinGecko Free API
2. **Token-Mapping** für Top 20 Token erstellen
3. **UI-Mockup** für Währungsanzeige
4. **Performance-Tests** mit verschiedenen Datumsbereichen
5. **Entscheidung** über Premium-API bei hohem Traffic

## Zusammenfassung

Die beste Strategie ist die Integration der **CoinGecko API** mit intelligentem Caching und einer robusten Fallback-Strategie. Dies ermöglicht akkurate historische Währungsumrechnung ohne hohe Kosten. Die Implementierung sollte schrittweise erfolgen, beginnend mit den wichtigsten Token (USDT, USDC, ETH) und kann später erweitert werden.