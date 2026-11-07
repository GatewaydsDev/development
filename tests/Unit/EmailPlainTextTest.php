<?php

use App\Support\EmailPlainText;

test('html email structure is preserved for readable message formatting', function () {
    $text = EmailPlainText::fromGraph('html', <<<'HTML'
        <h2>Project update</h2>
        <p>The opening is ready for review.</p>
        <ul>
            <li>Confirm dimensions</li>
            <li>Schedule delivery</li>
        </ul>
        <ol>
            <li>Open the drawing</li>
            <li>Send approval</li>
        </ol>
        <p>Visit <a href="https://example.com/project">the project page</a>.</p>
        HTML);

    expect($text)
        ->toContain('### Project update')
        ->toContain('The opening is ready for review.')
        ->toContain('• Confirm dimensions')
        ->toContain('• Schedule delivery')
        ->toContain('1. Open the drawing')
        ->toContain('2. Send approval')
        ->toContain('the project page (https://example.com/project)');
});
