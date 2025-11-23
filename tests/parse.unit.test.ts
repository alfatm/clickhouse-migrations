import { describe, expect, it } from 'vitest'

import { sqlQueries, sqlSets } from '../src/sql-parse'

describe('Sql query parse', () => {
  it('should parse single query with multiple comment styles', () => {
    const input = '-- any\n\n# other comment\n\n#! also comment\n  SELECT * \nFROM events;\n'

    const output = ['SELECT * FROM events']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should preserve -- inside string literals (bug fix)', () => {
    const input = "SELECT '-- not a comment' AS text, name FROM users;"

    const output = ["SELECT '-- not a comment' AS text, name FROM users"]

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should remove inline comments after code (PostgreSQL style)', () => {
    const input = 'SELECT * FROM table; -- inline comment\nSELECT id FROM users;'

    const output = ['SELECT * FROM table', 'SELECT id FROM users']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle comments with leading whitespace', () => {
    const input = '  -- comment with spaces\n\t-- comment with tab\nSELECT 1;'

    const output = ['SELECT 1']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle multiple queries with comments', () => {
    const input = '-- First query\nSELECT * FROM users;\n-- Second query\nSELECT * FROM events;'

    const output = ['SELECT * FROM users', 'SELECT * FROM events']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should preserve # inside string literals', () => {
    const input = "SELECT '# not a comment' AS text FROM table;"

    const output = ["SELECT '# not a comment' AS text FROM table"]

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should remove single-line block comment', () => {
    const input = 'SELECT /* inline comment */ * FROM users;'

    const output = ['SELECT * FROM users']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should remove multi-line block comment', () => {
    const input = `SELECT order_id, quantity
/*
 * Author: TechOnTheNet.com
 * Purpose: To show a comment that spans multiple lines
 */
FROM orders;`

    const output = ['SELECT order_id, quantity FROM orders']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should remove multiple block comments', () => {
    const input = '/* Comment 1 */ SELECT /* Comment 2 */ * FROM users /* Comment 3 */;'

    const output = ['SELECT * FROM users']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle mixed comment types', () => {
    const input = `-- Single line comment
/* Block comment */
SELECT * FROM users;
-- Another single line
/* Another
   block comment */
SELECT * FROM events;`

    const output = ['SELECT * FROM users', 'SELECT * FROM events']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should preserve /* */ inside string literals', () => {
    const input = "SELECT '/* text */' AS comment, name FROM table;"

    const output = ["SELECT '/* text */' AS comment, name FROM table"]

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle PostgreSQL-style inline comments in CREATE TABLE', () => {
    const input = `CREATE TABLE cmt_example(
id INT, --creating an INTEGER type column
name TEXT --creating a character type column
);`

    const output = ['CREATE TABLE cmt_example( id INT, name TEXT )']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should preserve -- inside string literals with inline comments', () => {
    const input = "SELECT '-- not a comment' AS text -- this is a comment\nFROM users;"

    const output = ["SELECT '-- not a comment' AS text FROM users"]

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle mixed block comments and string literals', () => {
    const input = "SELECT /* comment */ '/* not a comment */' AS text, id /* another */ FROM users;"

    const output = ["SELECT '/* not a comment */' AS text, id FROM users"]

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should preserve escaped quotes inside strings', () => {
    const input = "SELECT 'it\\'s /* a */ test' AS text FROM users;"

    const output = ["SELECT 'it\\'s /* a */ test' AS text FROM users"]

    expect(sqlQueries(input)).toEqual(output)
  })

  // Bug fix Doubled quotes handling
  it('should handle doubled single quotes (SQL escape)', () => {
    const input = "SELECT 'it''s a test' AS text FROM users;"

    const output = ["SELECT 'it''s a test' AS text FROM users"]

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle doubled double quotes', () => {
    const input = 'SELECT "say ""hello""" AS text FROM users;'

    const output = ['SELECT "say ""hello""" AS text FROM users']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle multiple doubled quotes in one string', () => {
    const input = "SELECT 'don''t say ''no''' AS text FROM users;"

    const output = ["SELECT 'don''t say ''no''' AS text FROM users"]

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle doubled quotes with comments', () => {
    const input = "SELECT 'it''s -- not a comment' AS text -- real comment\nFROM users;"

    const output = ["SELECT 'it''s -- not a comment' AS text FROM users"]

    expect(sqlQueries(input)).toEqual(output)
  })

  // Bug fix Block comments with string literals inside
  it('should handle /* */ with string literals containing */', () => {
    const input = "/* comment with 'string containing */' inside */ SELECT * FROM users;"

    const output = ['SELECT * FROM users']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle nested-looking block comments with quotes', () => {
    const input = "/* outer comment /* with 'fake */ inside string' */ SELECT id FROM table;"

    const output = ['SELECT id FROM table']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle block comment with multiple string literals', () => {
    const input = '/* comment \'str1 */\' and "str2 */" here */ SELECT 1;'

    const output = ['SELECT 1']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle complex case: block comment with doubled quotes', () => {
    const input = "/* comment with 'don''t stop here */' text */ SELECT 'it''s ok' FROM users;"

    const output = ["SELECT 'it''s ok' FROM users"]

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should preserve backticks for ClickHouse identifiers', () => {
    const input = 'SELECT `column-with-dash` FROM `table-name`;'

    const output = ['SELECT `column-with-dash` FROM `table-name`']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle backticks with comments', () => {
    const input = 'SELECT `field` FROM `db`.`table`; -- comment with `backticks`'

    const output = ['SELECT `field` FROM `db`.`table`']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle backticks in block comments', () => {
    const input = '/* comment with `identifier` */ SELECT `name` FROM users;'

    const output = ['SELECT `name` FROM users']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle mixed quotes and backticks', () => {
    const input = 'SELECT `col`, \'value\', "text" FROM `table`;'

    const output = ['SELECT `col`, \'value\', "text" FROM `table`']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should handle escaped backticks', () => {
    const input = 'SELECT `column\\`name` FROM users;'

    const output = ['SELECT `column\\`name` FROM users']

    expect(sqlQueries(input)).toEqual(output)
  })

  // Bug fix #1: Unterminated block comment should throw error
  it('should throw error for unterminated block comment', () => {
    const input = 'SELECT * FROM users; /* unterminated comment'

    expect(() => sqlQueries(input)).toThrow('Unterminated block comment in SQL')
  })

  it('should throw error for unterminated block comment with string inside', () => {
    const input = "SELECT * FROM users; /* comment with 'string' but no end"

    expect(() => sqlQueries(input)).toThrow('Unterminated block comment in SQL')
  })

  // Bug fix #2: Whitespace preservation when removing block comments
  it('should preserve whitespace when removing inline block comment', () => {
    const input = 'SELECT/*comment*/column FROM table;'

    const output = ['SELECT column FROM table']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should preserve whitespace when removing multiple inline block comments', () => {
    const input = 'SELECT/*c1*/id,/*c2*/name/*c3*/FROM/*c4*/users;'

    const output = ['SELECT id, name FROM users']

    expect(sqlQueries(input)).toEqual(output)
  })

  it('should not create double spaces when block comment is between spaces', () => {
    const input = 'SELECT /* comment */ column FROM table;'

    // The comment is replaced with a space, but surrounding spaces remain
    // This results in proper spacing: "SELECT  column FROM table"
    // which after .replace(/\s+/g, ' ') becomes "SELECT column FROM table"
    const output = ['SELECT column FROM table']

    expect(sqlQueries(input)).toEqual(output)
  })
})

describe('Sql settings parse', () => {
  it('should parse single SET statement with comments', () => {
    const input = '-- any\nSET allow_experimental_json_type = 1;\n\n --set option\nSELECT * FROM events'

    const output = { allow_experimental_json_type: '1' }

    expect(sqlSets(input)).toEqual(output)
  })

  it('should parse multiple SET statements with comments', () => {
    const input =
      '-- any\nSET allow_experimental_json_type = 1;\n-- set option\nSET allow_experimental_object_new = 1;\nSELECT * \n  --comment\n  FROM events\n'

    const output = { allow_experimental_json_type: '1', allow_experimental_object_new: '1' }

    expect(sqlSets(input)).toEqual(output)
  })

  it('should handle SET value containing equals sign', () => {
    const input = "SET option = 'value=something';\nSELECT * FROM events"

    const output = { option: 'value=something' }

    expect(sqlSets(input)).toEqual(output)
  })

  it('should ignore SET statement without value', () => {
    const input = 'SET option_without_value;\nSET valid_option = 1;\nSELECT * FROM events'

    const output = { valid_option: '1' }

    expect(sqlSets(input)).toEqual(output)
  })

  it('should parse SET with both quoted and numeric values', () => {
    const input = "SET string_option = 'sometext';\nSET number_option = 123;\nSELECT * FROM events"

    const output = { string_option: 'sometext', number_option: '123' }

    expect(sqlSets(input)).toEqual(output)
  })
})
