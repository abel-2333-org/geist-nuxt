<template>
  <!-- API Docs internal layout primitive. Public components own fact semantics;
       this helper owns only definition-list structure and container scope. -->
  <dl data-fact-list class="@container/facts divide-y divide-default">
    <slot />
  </dl>
</template>
